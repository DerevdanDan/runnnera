import { createFileRoute } from "@tanstack/react-router";

// TEMPORARY — local verification only; deleted after testing.
export const Route = createFileRoute("/api/dev-login-temp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.hostname !== "localhost") return new Response("no", { status: 404 });
        const { getAppSession } = await import("@/lib/session.server");
        const session = await getAppSession();
        await session.update({ athleteId: Number(url.searchParams.get("a") ?? "999001") });
        return new Response(null, { status: 302, headers: { Location: "/" } });
      },
    },
  },
});
