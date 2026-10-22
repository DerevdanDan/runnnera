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

## Architecture rules
- Sign-in is pick-your-name + 4-digit PIN (PBKDF2 hash on `players`), set on first sign-in; identity lives in an encrypted TanStack session cookie (`src/lib/session.server.ts`). Why: friends lack Strava API access, and Cloud Auth would require emails for a tiny private group.
- All league tables are RLS-locked with no policies and accessed only via `supabaseAdmin` inside server functions after resolving the session player. Why: there is no Supabase user session in the browser.
- Km come from manually logged `runs` (with a screenshot in the private `run-photos` bucket, served via signed URLs). Standings and the feed are public; logging/editing requires sign-in and only the owner edits, until that month is spun.
- Admin rights are the `players.is_admin` flag, checked server-side in `requireAdmin`.
- Pure league rules (month keys, loser selection, punishment cap, run totals/edit rules, PIN format) live in `src/lib/league.ts` with tests in `league.test.ts`; server code must reuse them.
