import { useSession } from "@tanstack/react-start/server";

export type AppSessionData = {
  athleteId?: number | undefined;
  oauthState?: string | undefined;
};

function getSessionConfig() {
  const password = process.env["SESSION_SECRET"];
  if (!password) throw new Error("SESSION_SECRET is not configured");
  return {
    password,
    name: "lps-session",
    maxAge: 60 * 60 * 24 * 60, // 60 days
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

export async function getAppSession() {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- server session helper, not a React hook
  return useSession<AppSessionData>(getSessionConfig());
}
