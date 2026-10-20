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
- Sign-in is Strava OAuth (`/api/public/strava/login` + `/callback`), not Cloud Auth; identity lives in an encrypted TanStack session cookie (`src/lib/session.server.ts`). Why: Cloud Auth has no Strava provider, and logging in must grant activity access in one step.
- All league tables are RLS-locked with no policies and accessed only via `supabaseAdmin` inside server functions/routes after resolving the session player. Why: there is no Supabase user session in the browser.
- Pure league rules (month keys, loser selection, punishment cap, run filtering) live in `src/lib/league.ts` with tests in `league.test.ts`; server code must reuse them rather than re-implement.
- Strava km are cached per player/month in `monthly_distance` and re-synced on dashboard load at most every 10 minutes. Why: Strava API rate limits.
