import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/strava/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.origin;
        const back = (error?: string) =>
          new Response(null, {
            status: 302,
            headers: { Location: error ? `${origin}/?error=${error}` : `${origin}/` },
          });

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const scope = url.searchParams.get("scope") ?? "";
        if (url.searchParams.get("error")) return back("strava_denied");
        if (!code || !state) return back("strava_failed");

        const { getAppSession } = await import("@/lib/session.server");
        const session = await getAppSession();
        if (!session.data.oauthState || session.data.oauthState !== state) {
          return back("strava_state");
        }
        if (!scope.split(",").some((s) => s.startsWith("activity:read"))) {
          await session.update({ ...session.data, oauthState: undefined });
          return back("strava_scope");
        }

        try {
          const { exchangeCode } = await import("@/lib/strava.server");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const token = await exchangeCode(code);
          const athlete = token.athlete;
          if (!athlete?.id) return back("strava_failed");

          const { error } = await supabaseAdmin.from("strava_accounts").upsert({
            athlete_id: athlete.id,
            firstname: athlete.firstname ?? null,
            lastname: athlete.lastname ?? null,
            avatar_url: athlete.profile ?? null,
            access_token: token.access_token,
            refresh_token: token.refresh_token,
            expires_at: token.expires_at,
            scope,
            updated_at: new Date().toISOString(),
          });
          if (error) {
            console.error("Saving Strava account failed", error);
            return back("strava_failed");
          }
          await session.update({ athleteId: athlete.id, oauthState: undefined });
          return back();
        } catch (err) {
          console.error(err);
          return back("strava_failed");
        }
      },
    },
  },
});
