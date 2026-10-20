import { findLoser, monthBounds, monthKey, previousMonthKey, rankStandings } from "./league";
import type { Dashboard, StandingRow, WheelSlice } from "./league-types";
import { getAppSession } from "./session.server";
import { fetchMonthRuns, getStravaCredentials, getValidAccessToken } from "./strava.server";

const SYNC_INTERVAL_MS = 10 * 60 * 1000;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type PlayerRow = {
  id: string;
  name: string;
  athlete_id: number | null;
  strava_accounts: {
    athlete_id: number;
    avatar_url: string | null;
    access_token: string;
    refresh_token: string;
    expires_at: number;
  } | null;
};

async function loadPlayers(): Promise<PlayerRow[]> {
  const db = await admin();
  const { data, error } = await db
    .from("players")
    .select(
      "id, name, athlete_id, strava_accounts(athlete_id, avatar_url, access_token, refresh_token, expires_at)",
    )
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlayerRow[];
}

/** Session athlete id, or null when signed out. */
export async function getSessionAthleteId(): Promise<number | null> {
  const session = await getAppSession();
  return session.data.athleteId ?? null;
}

/** The signed-in player, or throws. */
export async function requirePlayer(): Promise<{ id: string; name: string }> {
  const athleteId = await getSessionAthleteId();
  if (!athleteId) throw new Error("Please sign in with Strava first");
  const db = await admin();
  const { data } = await db
    .from("players")
    .select("id, name")
    .eq("athlete_id", athleteId)
    .maybeSingle();
  if (!data) throw new Error("Pick your name first");
  return data;
}

/** Sync a month's km for every connected player when stale. Returns an error message if any sync failed. */
async function syncMonth(players: PlayerRow[], month: string): Promise<string | null> {
  const db = await admin();
  const { data: rows } = await db
    .from("monthly_distance")
    .select("player_id, synced_at")
    .eq("month", month);
  const lastSync = new Map((rows ?? []).map((r) => [r.player_id, new Date(r.synced_at).getTime()]));
  const { end } = monthBounds(month);
  const now = Date.now();
  let failure: string | null = null;

  await Promise.all(
    players.map(async (p) => {
      if (!p.strava_accounts) return;
      const last = lastSync.get(p.id);
      // A finished month synced after it ended (plus a day for late uploads) is final.
      if (last && last > end.getTime() + 86_400_000) return;
      if (last && now - last < SYNC_INTERVAL_MS) return;
      try {
        const token = await getValidAccessToken(p.strava_accounts, db);
        const { meters, runs } = await fetchMonthRuns(token, month);
        await db.from("monthly_distance").upsert({
          player_id: p.id,
          month,
          meters,
          run_count: runs,
          synced_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error(`Strava sync failed for ${p.name}`, err);
        failure = `Couldn't refresh ${p.name}'s Strava runs right now.`;
      }
    }),
  );
  return failure;
}

async function standingsFor(players: PlayerRow[], month: string): Promise<StandingRow[]> {
  const db = await admin();
  const { data } = await db
    .from("monthly_distance")
    .select("player_id, meters, run_count, synced_at")
    .eq("month", month);
  const byPlayer = new Map((data ?? []).map((r) => [r.player_id, r]));
  return rankStandings(
    players
      .filter((p) => p.athlete_id !== null)
      .map((p) => {
        const r = byPlayer.get(p.id);
        return {
          playerId: p.id,
          name: p.name,
          avatarUrl: p.strava_accounts?.avatar_url ?? null,
          connected: !!p.strava_accounts,
          meters: r?.meters ?? 0,
          runs: r?.run_count ?? 0,
          syncedAt: r?.synced_at ?? null,
        };
      }),
  );
}

export async function buildDashboard(): Promise<Dashboard> {
  const athleteId = await getSessionAthleteId();
  if (!athleteId) return { state: "signed_out", stravaConfigured: !!getStravaCredentials() };

  const db = await admin();
  const players = await loadPlayers();
  const mine = players.find((p) => p.athlete_id === athleteId);

  if (!mine) {
    const { data: account } = await db
      .from("strava_accounts")
      .select("firstname, avatar_url")
      .eq("athlete_id", athleteId)
      .maybeSingle();
    if (!account) {
      // Stale session (account removed) — treat as signed out.
      const session = await getAppSession();
      await session.clear();
      return { state: "signed_out", stravaConfigured: !!getStravaCredentials() };
    }
    return {
      state: "needs_claim",
      athleteName: account.firstname ?? "runner",
      avatarUrl: account.avatar_url,
      openSlots: players.filter((p) => p.athlete_id === null).map((p) => ({ id: p.id, name: p.name })),
    };
  }

  const month = monthKey(new Date());
  const prev = previousMonthKey(month);

  const { data: prevSpin } = await db
    .from("spins")
    .select("punishment_id, spun_at, loser_player_id")
    .eq("month", prev)
    .maybeSingle();

  const syncResults = await Promise.all([
    syncMonth(players, month),
    prevSpin ? Promise.resolve(null) : syncMonth(players, prev),
  ]);
  const syncError = syncResults.find((e) => e) ?? null;

  const [standings, prevStandings] = await Promise.all([
    standingsFor(players, month),
    standingsFor(players, prev),
  ]);

  const { data: punishments } = await db
    .from("punishments")
    .select("id, player_id, month, text, created_at")
    .in("month", [month, prev])
    .order("created_at");
  const nameOf = new Map(players.map((p) => [p.id, p.name]));

  const current = (punishments ?? []).filter((p) => p.month === month);
  const myPunishments = current.filter((p) => p.player_id === mine.id).map((p) => ({ id: p.id, text: p.text }));
  const punishmentCounts = players
    .filter((p) => p.athlete_id !== null)
    .map((p) => ({ name: p.name, count: current.filter((x) => x.player_id === p.id).length }));

  const wheel: WheelSlice[] = (punishments ?? [])
    .filter((p) => p.month === prev)
    .map((p) => ({ id: p.id, text: p.text, author: nameOf.get(p.player_id) ?? "?" }));

  let lastMonth: Extract<Dashboard, { state: "ready" }>["lastMonth"] = null;
  const hadActivity = prevStandings.some((s) => s.meters > 0) || wheel.length > 0 || prevSpin;
  if (hadActivity) {
    const loserStanding = prevSpin
      ? prevStandings.find((s) => s.playerId === prevSpin.loser_player_id) ?? null
      : findLoser(prevStandings);
    const loser = prevSpin
      ? { playerId: prevSpin.loser_player_id, name: nameOf.get(prevSpin.loser_player_id) ?? "?" }
      : loserStanding
        ? { playerId: loserStanding.playerId, name: loserStanding.name }
        : null;
    const spunSlice = prevSpin ? wheel.find((w) => w.id === prevSpin.punishment_id) : undefined;
    lastMonth = {
      month: prev,
      standings: prevStandings,
      loser,
      wheel,
      spin:
        prevSpin && spunSlice
          ? { punishmentId: spunSlice.id, text: spunSlice.text, author: spunSlice.author, spunAt: prevSpin.spun_at }
          : null,
      canSpin: !prevSpin && !!loser && loser.playerId === mine.id && wheel.length > 0,
    };
  }

  return {
    state: "ready",
    me: { playerId: mine.id, name: mine.name, avatarUrl: mine.strava_accounts?.avatar_url ?? null },
    month,
    standings,
    myPunishments,
    punishmentCounts,
    lastMonth,
    syncError,
  };
}

export async function spinForLastMonth(): Promise<{ punishmentId: string }> {
  const me = await requirePlayer();
  const db = await admin();
  const prev = previousMonthKey(monthKey(new Date()));

  const { data: existing } = await db.from("spins").select("punishment_id").eq("month", prev).maybeSingle();
  if (existing) return { punishmentId: existing.punishment_id };

  const players = await loadPlayers();
  const loser = findLoser(await standingsFor(players, prev));
  if (!loser || loser.playerId !== me.id) throw new Error("Only last month's last place can spin the wheel");

  const { data: slices } = await db.from("punishments").select("id").eq("month", prev);
  if (!slices || slices.length === 0) throw new Error("No punishments were submitted last month");

  const pick = new Uint32Array(1);
  crypto.getRandomValues(pick);
  const chosen = slices[(pick[0] ?? 0) % slices.length];
  if (!chosen) throw new Error("No punishments were submitted last month");

  const { error } = await db
    .from("spins")
    .insert({ month: prev, loser_player_id: me.id, punishment_id: chosen.id });
  if (error) {
    // Lost a race with a concurrent spin — return the stored result.
    const { data: again } = await db.from("spins").select("punishment_id").eq("month", prev).maybeSingle();
    if (again) return { punishmentId: again.punishment_id };
    throw new Error(error.message);
  }
  return { punishmentId: chosen.id };
}
