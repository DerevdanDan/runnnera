import { canEditRun, findLoser, monthKey, previousMonthKey, rankStandings, totalsForMonth } from "./league";
import type { Dashboard, FeedRun, PunishmentRow, StandingRow, WheelSlice } from "./league-types";
import { getAppSession, type AppSessionData } from "./session.server";

export const PHOTO_BUCKET = "run-photos";
const FEED_LIMIT = 100;

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const PLAYER_COLUMNS = "id, name, is_admin, user_id, email";
type PlayerRow = { id: string; name: string; is_admin: boolean; user_id: string | null; email: string | null };

async function loadPlayers(): Promise<PlayerRow[]> {
  const db = await admin();
  const { data, error } = await db.from("players").select(PLAYER_COLUMNS).order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** The session only counts while the same Google account still owns the player (the admin can reset it). */
function ownsPlayer(p: PlayerRow, s: AppSessionData): boolean {
  return !!s.userId && p.id === s.playerId && p.user_id === s.userId;
}

export async function startSession(playerId: string, userId: string) {
  const session = await getAppSession();
  await session.update({ playerId, userId });
}

/** The signed-in player, or throws. */
export async function requirePlayer(): Promise<PlayerRow> {
  const session = await getAppSession();
  const id = session.data.playerId;
  if (!id) throw new Error("Please sign in first");
  const db = await admin();
  const { data } = await db.from("players").select(PLAYER_COLUMNS).eq("id", id).maybeSingle();
  if (!data || !ownsPlayer(data, session.data)) throw new Error("Please sign in first");
  return data;
}

export async function requireAdmin(): Promise<PlayerRow> {
  const me = await requirePlayer();
  if (!me.is_admin) throw new Error("Only the admin can do that");
  return me;
}

async function isMonthSpun(month: string): Promise<boolean> {
  const db = await admin();
  const { data } = await db.from("spins").select("month").eq("month", month).maybeSingle();
  return !!data;
}

/** Owner check + month-not-spun check for editing a run. */
export async function assertCanEditRun(runId: string, meId: string) {
  const db = await admin();
  const { data: run } = await db.from("runs").select("id, player_id, run_date, photo_path").eq("id", runId).maybeSingle();
  if (!run) throw new Error("Run not found");
  const spun = await isMonthSpun(run.run_date.slice(0, 7));
  if (!canEditRun({ isOwner: run.player_id === meId, monthSpun: spun })) {
    throw new Error(spun ? "That month's wheel was already spun" : "You can only edit your own runs");
  }
  return run;
}

async function standingsFor(players: PlayerRow[], month: string): Promise<StandingRow[]> {
  const db = await admin();
  const [y, m] = month.split("-").map(Number) as [number, number];
  const end = monthKey(new Date(Date.UTC(y, m, 1)));
  const { data } = await db
    .from("runs")
    .select("player_id, run_date, meters")
    .gte("run_date", `${month}-01`)
    .lt("run_date", `${end}-01`);
  const totals = totalsForMonth(data ?? [], month);
  return rankStandings(
    players.map((p) => ({
      playerId: p.id,
      name: p.name,
      meters: totals.get(p.id)?.meters ?? 0,
      runs: totals.get(p.id)?.runs ?? 0,
    })),
  );
}

async function loadFeed(players: PlayerRow[], meId: string | null): Promise<FeedRun[]> {
  const db = await admin();
  const { data } = await db
    .from("runs")
    .select("id, player_id, run_date, meters, duration_seconds, note, photo_path, created_at, updated_at")
    .order("run_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(FEED_LIMIT);
  const rows = data ?? [];
  const { data: spins } = await db.from("spins").select("month");
  const spun = new Set((spins ?? []).map((s) => s.month));
  const paths = rows.map((r) => r.photo_path).filter((p): p is string => !!p);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await db.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 60 * 60 * 6);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  const nameOf = new Map(players.map((p) => [p.id, p.name]));
  return rows.map((r) => ({
    id: r.id,
    playerId: r.player_id,
    name: nameOf.get(r.player_id) ?? "?",
    runDate: r.run_date,
    meters: r.meters,
    durationSeconds: r.duration_seconds,
    note: r.note,
    photoUrl: r.photo_path ? (urls.get(r.photo_path) ?? null) : null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    canEdit: canEditRun({ isOwner: r.player_id === meId, monthSpun: spun.has(r.run_date.slice(0, 7)) }),
  }));
}

export async function buildDashboard(): Promise<Dashboard> {
  const players = await loadPlayers();
  const session = await getAppSession();
  const mine = players.find((p) => ownsPlayer(p, session.data));
  if (!mine) {
    const month = monthKey(new Date());
    const [standings, feed] = await Promise.all([standingsFor(players, month), loadFeed(players, null)]);
    return { state: "signed_out", month, standings, feed };
  }

  const db = await admin();
  const month = monthKey(new Date());
  const prev = previousMonthKey(month);

  const [{ data: prevSpin }, standings, prevStandings, feed, { data: punishments }] = await Promise.all([
    db.from("spins").select("punishment_id, spun_at, loser_player_id").eq("month", prev).maybeSingle(),
    standingsFor(players, month),
    standingsFor(players, prev),
    loadFeed(players, mine.id),
    db.from("punishments").select("id, player_id, month, text, created_at").in("month", [month, prev]).order("created_at"),
  ]);
  const nameOf = new Map(players.map((p) => [p.id, p.name]));

  const current: PunishmentRow[] = (punishments ?? [])
    .filter((p) => p.month === month)
    .map((p) => ({ id: p.id, text: p.text, playerId: p.player_id, author: nameOf.get(p.player_id) ?? "?" }));

  const wheel: WheelSlice[] = (punishments ?? [])
    .filter((p) => p.month === prev)
    .map((p) => ({ id: p.id, text: p.text, author: nameOf.get(p.player_id) ?? "?" }));

  let lastMonth: Extract<Dashboard, { state: "ready" }>["lastMonth"] = null;
  const hadActivity = prevStandings.some((s) => s.meters > 0) || wheel.length > 0 || prevSpin;
  if (hadActivity) {
    const loserStanding = prevSpin ? null : findLoser(prevStandings);
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
      // The admin can spin for a loser who never shows up, so the month always gets settled.
      canSpin: !prevSpin && !!loser && (loser.playerId === mine.id || mine.is_admin) && wheel.length > 0,
    };
  }

  return {
    state: "ready",
    me: { playerId: mine.id, name: mine.name, isAdmin: mine.is_admin },
    month,
    standings,
    punishments: current,
    people: mine.is_admin
      ? players.map((p) => ({ id: p.id, name: p.name, email: p.email, claimed: !!p.user_id, isAdmin: p.is_admin }))
      : null,
    lastMonth,
    feed,
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
  if (!loser || (loser.playerId !== me.id && !me.is_admin)) {
    throw new Error("Only last month's last place (or the admin) can spin the wheel");
  }

  const { data: slices } = await db.from("punishments").select("id").eq("month", prev);
  if (!slices || slices.length === 0) throw new Error("No punishments were submitted last month");

  const pick = new Uint32Array(1);
  crypto.getRandomValues(pick);
  const chosen = slices[(pick[0] ?? 0) % slices.length];
  if (!chosen) throw new Error("No punishments were submitted last month");

  const { error } = await db
    .from("spins")
    .insert({ month: prev, loser_player_id: loser.playerId, punishment_id: chosen.id });
  if (error) {
    const { data: again } = await db.from("spins").select("punishment_id").eq("month", prev).maybeSingle();
    if (again) return { punishmentId: again.punishment_id };
    throw new Error(error.message);
  }
  return { punishmentId: chosen.id };
}

/** Decode a data URL image and upload it; returns the storage path. */
export async function uploadPhoto(playerId: string, dataUrl: string): Promise<string> {
  const m = /^data:(image\/(jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error("Screenshot must be a JPEG, PNG or WebP image");
  const bytes = Uint8Array.from(atob(m[3]!), (c) => c.charCodeAt(0));
  if (bytes.byteLength > 6 * 1024 * 1024) throw new Error("Screenshot is too large (max 6 MB)");
  const ext = m[2] === "jpeg" ? "jpg" : m[2];
  const path = `${playerId}/${crypto.randomUUID()}.${ext}`;
  const db = await admin();
  const { error } = await db.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: m[1] ?? "image/jpeg" });
  if (error) throw new Error("Couldn't upload the screenshot");
  return path;
}

export async function removePhoto(path: string | null) {
  if (!path) return;
  const db = await admin();
  await db.storage.from(PHOTO_BUCKET).remove([path]);
}
