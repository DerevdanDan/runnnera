// Pure, browser-safe league rules shared by server and UI.

export const MAX_PUNISHMENTS_PER_MONTH = 3;
export const MAX_PUNISHMENT_LENGTH = 140;

/** "YYYY-MM" for a date, in UTC. */
export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parseMonth(month: string): [number, number] {
  const [y = 1970, m = 1] = month.split("-").map(Number);
  return [y, m];
}

export function previousMonthKey(month: string): string {
  const [y, m] = parseMonth(month);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return monthKey(d);
}

/** UTC start (inclusive) and end (exclusive) of a month. */
export function monthBounds(month: string): { start: Date; end: Date } {
  const [y, m] = parseMonth(month);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

export function daysLeftInMonth(now: Date): number {
  const { end } = monthBounds(monthKey(now));
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
}

export function formatMonth(month: string): string {
  const { start } = monthBounds(month);
  return start.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export type Standing = { playerId: string; name: string; meters: number; runs: number };

/** Sorted most km first; the exact reverse of findLoser's order, so the bottom row is who must spin. */
export function rankStandings<T extends Standing>(standings: T[]): T[] {
  return [...standings].sort(
    (a, b) => b.meters - a.meters || b.runs - a.runs || b.name.localeCompare(a.name),
  );
}

/**
 * The player who must spin: least distance. Ties are broken by fewer runs,
 * then alphabetically by name. Returns null when there are no players.
 */
export function findLoser<T extends Standing>(standings: T[]): T | null {
  if (standings.length === 0) return null;
  const sorted = [...standings].sort(
    (a, b) => a.meters - b.meters || a.runs - b.runs || a.name.localeCompare(b.name),
  );
  return sorted[0] ?? null;
}

export function canAddPunishment(existingCount: number): boolean {
  return existingCount < MAX_PUNISHMENTS_PER_MONTH;
}

export function metersToKm(meters: number): number {
  return Math.round(meters / 100) / 10;
}

// ---- Manual run logging ----
export const MAX_RUN_KM = 200;
export const MAX_RUN_NOTE_LENGTH = 280;

export type LoggedRun = { player_id: string; run_date: string; meters: number };

/** Total meters and run count per player for runs dated (YYYY-MM-DD) inside `month`. */
export function totalsForMonth(runs: LoggedRun[], month: string): Map<string, { meters: number; runs: number }> {
  const out = new Map<string, { meters: number; runs: number }>();
  for (const r of runs) {
    if (r.run_date.slice(0, 7) !== month) continue;
    const t = out.get(r.player_id) ?? { meters: 0, runs: 0 };
    t.meters += r.meters;
    t.runs += 1;
    out.set(r.player_id, t);
  }
  return out;
}

/** Owners can edit their runs until that month's wheel has been spun; the admin can fix any run at any time. */
export function canEditRun(opts: { isOwner: boolean; monthSpun: boolean; isAdmin?: boolean }): boolean {
  return !!opts.isAdmin || (opts.isOwner && !opts.monthSpun);
}

/** Whoever can edit a run can also delete it. */
export function canDeleteRun(opts: { isOwner: boolean; isAdmin: boolean; monthSpun: boolean }): boolean {
  return canEditRun(opts);
}

/**
 * Owners can delete their own punishments for the current month; the admin can delete anyone's.
 * Never once that month's wheel has been spun — the spin points at one of them.
 */
export function canDeletePunishment(opts: {
  isOwner: boolean;
  isAdmin: boolean;
  isCurrentMonth: boolean;
  monthSpun: boolean;
}): boolean {
  if (opts.monthSpun) return false;
  return opts.isAdmin || (opts.isOwner && opts.isCurrentMonth);
}

/** A run date must not be in the future (allow 1 day for time zones). */
export function isValidRunDate(date: string, now: Date): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const t = Date.parse(`${date}T00:00:00Z`);
  return !Number.isNaN(t) && t <= now.getTime() + 86_400_000;
}

// ---- Newcomers ----

export function nextMonthKey(month: string): string {
  const [y, m] = parseMonth(month);
  return monthKey(new Date(Date.UTC(y, m, 1)));
}

/** A player can only come last from their `countsFrom` month on; someone added mid-month starts next month. */
export function countsInMonth(countsFrom: string, month: string): boolean {
  return countsFrom <= month;
}

/** Last place among the players who count this month (newcomers in their first month are skipped). */
export function findMonthLoser<T extends Standing & { counts: boolean }>(standings: T[]): T | null {
  return findLoser(standings.filter((s) => s.counts));
}

// ---- Gmail locks ----

/** Compare Google accounts the way Gmail does: case-insensitive, and for Gmail ignore dots and "+tags". */
export function normalizeEmail(email: string): string {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return `${local.split("+")[0]!.replaceAll(".", "")}@gmail.com`;
  }
  return `${local}@${domain}`;
}

// ---- Duplicate runs ----

export type RunFingerprint = {
  playerId: string;
  runDate: string;
  meters: number;
  durationSeconds: number | null;
  photoHash: string | null;
};

/**
 * The same screenshot file (anyone's), or the same player logging the same day, distance (±50 m) and
 * time (±1 min) twice. Different people with matching numbers just ran together.
 */
export function isSameRun(a: RunFingerprint, b: RunFingerprint): boolean {
  if (a.photoHash && b.photoHash && a.photoHash === b.photoHash) return true;
  if (a.playerId !== b.playerId) return false;
  if (a.runDate !== b.runDate || Math.abs(a.meters - b.meters) > 50) return false;
  if (a.durationSeconds === null || b.durationSeconds === null) return a.durationSeconds === b.durationSeconds;
  return Math.abs(a.durationSeconds - b.durationSeconds) <= 60;
}

// ---- Stats ----

export type PlayerStats = {
  playerId: string;
  monthKm: number;
  /** This month's km divided by the days of the month so far (today included). */
  avgKmPerDay: number;
  monthRuns: number;
  longestKm: number;
  totalKm: number;
  totalRuns: number;
  /** Weeks in a row (Monday–Sunday) with at least one run; this week counts once it has a run. */
  weekStreak: number;
  /** Km per week for the last `weeks` weeks, oldest first, ending with this week. */
  weeklyKm: number[];
};

function utcDay(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / 86_400_000;
}

/** Day number of the Monday that starts the week containing `day` (days since 1970-01-01, a Thursday). */
function weekStart(day: number): number {
  return day - ((day + 3) % 7);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeStats(runs: LoggedRun[], playerIds: string[], today: string, weeks = 6): PlayerStats[] {
  const month = today.slice(0, 7);
  const daysSoFar = Number(today.slice(8, 10));
  const thisWeek = weekStart(utcDay(today));
  return playerIds.map((playerId) => {
    const mine = runs.filter((r) => r.player_id === playerId && r.run_date <= today);
    const inMonth = mine.filter((r) => r.run_date.slice(0, 7) === month);
    const monthMeters = inMonth.reduce((sum, r) => sum + r.meters, 0);
    const weeksWithRuns = new Set(mine.map((r) => weekStart(utcDay(r.run_date))));
    let week = weeksWithRuns.has(thisWeek) ? thisWeek : thisWeek - 7;
    let weekStreak = 0;
    while (weeksWithRuns.has(week)) {
      weekStreak += 1;
      week -= 7;
    }
    const weeklyKm = Array.from({ length: weeks }, (_, i) => {
      const start = thisWeek - (weeks - 1 - i) * 7;
      const meters = mine
        .filter((r) => weekStart(utcDay(r.run_date)) === start)
        .reduce((sum, r) => sum + r.meters, 0);
      return round1(meters / 1000);
    });
    return {
      playerId,
      monthKm: round1(monthMeters / 1000),
      avgKmPerDay: Math.round((monthMeters / 1000 / daysSoFar) * 100) / 100,
      monthRuns: inMonth.length,
      longestKm: round1(Math.max(0, ...mine.map((r) => r.meters)) / 1000),
      totalKm: round1(mine.reduce((sum, r) => sum + r.meters, 0) / 1000),
      totalRuns: mine.length,
      weekStreak,
      weeklyKm,
    };
  });
}
