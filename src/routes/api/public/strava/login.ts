import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/strava/login")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getStravaCredentials } = await import("@/lib/strava.server");
        const { getAppSession } = await import("@/lib/session.server");
        const creds = getStravaCredentials();
        const origin = new URL(request.url).origin;
        if (!creds) {
          return Response.redirect(`${origin}/?error=strava_not_configured`, 302);
        }
        const state = crypto.randomUUID();
        const session = await getAppSession();
        await session.update({ ...session.data, oauthState: state });

        const authorize = new URL("https://www.strava.com/oauth/authorize");
        authorize.searchParams.set("client_id", creds.clientId);
        authorize.searchParams.set("redirect_uri", `${origin}/api/public/strava/callback`);
        authorize.searchParams.set("response_type", "code");
        authorize.searchParams.set("approval_prompt", "auto");
        authorize.searchParams.set("scope", "read,activity:read_all");
        authorize.searchParams.set("state", state);
        return new Response(null, { status: 302, headers: { Location: authorize.toString() } });
      },
    },
  },
});
