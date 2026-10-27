<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Hosting
- Live: Vercel (`runnnera.vercel.app`, auto-deploys from `main`) + its own Supabase project. Lovable no longer hosts it.
- Local dev uses a separate test Supabase project via `.env.local`; never point experiments at the live project.
- Schema changes are drizzle migrations in `drizzle/migrations` (journal + snapshot); apply them to the live database before pushing code that needs them.

## Architecture rules
- Sign-in is Google (Supabase Auth) + claim-your-name: right after Google sign-in, `linkGoogleAccount`/`claimPlayer` link the Google user to a `players` row (`user_id`, `email`), then identity lives in an encrypted TanStack session cookie (`src/lib/session.server.ts`) holding `playerId` + `userId`. The session only counts while that player's `user_id` still matches, so the admin's "Reset sign-in" logs a player out.
- All league tables are RLS-locked with no policies and accessed only via `supabaseAdmin` inside server functions after resolving the session player. The Supabase session in the browser is used only to prove the Google identity when linking.
- Km come from manually logged `runs` (with a screenshot in the private `run-photos` bucket, served via signed URLs). A screenshot pre-fills distance/time/date via in-browser OCR (`src/lib/run-screenshot.ts`, tested). Standings, the feed and this month's wheel of punishments are public; logging requires sign-in, owners edit/delete their runs until that month is spun, and the admin can edit or delete any run.
- Admin rights are the `players.is_admin` flag, checked server-side in `requireAdmin`. The admin adds people, locks names to a Gmail, resets claimed names, edits/deletes anyone's runs, deletes anyone's punishments (never in a spun month: the spin points at one), and can spin for a last place who doesn't.
- Newcomers: `players.counts_from` (YYYY-MM) is the first month someone can come last. People added by the admin start next month; the admin can toggle "count this month too". Always pick the loser with `findMonthLoser`, never `findLoser` on the raw standings.
- Gmail locks: `players.invite_email` (stored via `normalizeEmail`) reserves a name for one Google account; that account is linked straight to it on sign-in and nobody else is offered the name.
- Duplicate runs: the client sends a SHA-256 of the original screenshot (`runs.photo_hash`); `addRun` returns `duplicateOf` (instead of saving) for the same file, or the same player/day/km/time, until the user confirms.
- Punishment proof: photo/video in `run-photos/proofs/<month>/`, uploaded straight from the browser via a signed upload URL (`startProofUpload` → `uploadToSignedUrl` → `saveProof`) so big videos skip the 4.5 MB Vercel body limit; only that month's loser or the admin.
- Pages: `/` (dashboard), `/stats` (`computeStats`: month km, avg km/day, longest run, weekly streak, last 6 weeks), `/history` (hall of shame). Shared header in `AppHeader`; query keys in `src/lib/queries.ts`. Installable as a phone app via `public/manifest.webmanifest` + icons.
- Pure league rules (month keys, loser selection, ranking, punishment cap, run totals, edit/delete rules, newcomers, email normalising, duplicate check, stats) live in `src/lib/league.ts` with tests in `league.test.ts`; server code must reuse them. `rankStandings` is the exact reverse of `findLoser`, so the leaderboard's bottom row is always who spins.
