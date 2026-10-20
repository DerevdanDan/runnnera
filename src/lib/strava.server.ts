import { monthBounds, sumRunsForMonth, type StravaActivityLite } from "./league";

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API = "https://www.strava.com/api/v3";

export function getStravaCredentials() {
  const clientId = process.env["STRAVA_CLIENT_ID"];
  const clientSecret = process.env["STRAVA_CLIENT_SECRET"];
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export type StravaTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number; firstname?: string; lastname?: string; profile?: string };
};

async function postToken(params: Record<string, string>): Promise<StravaTokenResponse> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Strava token request failed [${res.status}]: ${body}`);
    throw new Error(`Strava token request failed [${res.status}]`);
  }
  return (await res.json()) as StravaTokenResponse;
}

export async function exchangeCode(code: string): Promise<StravaTokenResponse> {
  const creds = getStravaCredentials();
  if (!creds) throw new Error("Strava keys are not configured");
  return postToken({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    code,
    grant_type: "authorization_code",
  });
}

type AccountRow = {
  athlete_id: number;
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

/** Returns a valid access token, refreshing and persisting it if near expiry. */
export async function getValidAccessToken(
  account: AccountRow,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (account.expires_at - 300 > now) return account.access_token;
  const creds = getStravaCredentials();
  if (!creds) throw new Error("Strava keys are not configured");
  const t = await postToken({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: "refresh_token",
    refresh_token: account.refresh_token,
  });
  await admin
    .from("strava_accounts")
    .update({
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expires_at: t.expires_at,
      updated_at: new Date().toISOString(),
    })
    .eq("athlete_id", account.athlete_id);
  return t.access_token;
}

/** Fetch the athlete's runs for a month and total them. */
export async function fetchMonthRuns(
  accessToken: string,
  month: string,
): Promise<{ meters: number; runs: number }> {
  const { start, end } = monthBounds(month);
  // Pad by a day each side; exact month membership uses the local start date.
  const after = Math.floor(start.getTime() / 1000) - 86_400;
  const before = Math.floor(end.getTime() / 1000) + 86_400;
  const all: StravaActivityLite[] = [];
  for (let page = 1; page <= 5; page++) {
    const url = `${STRAVA_API}/athlete/activities?after=${after}&before=${before}&per_page=200&page=${page}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Strava activities failed [${res.status}]: ${body}`);
      throw new Error(`Strava activities failed [${res.status}]`);
    }
    const batch = (await res.json()) as StravaActivityLite[];
    all.push(...batch);
    if (batch.length < 200) break;
  }
  return sumRunsForMonth(all, month);
}
