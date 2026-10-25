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

/** Sorted most km first. */
export function rankStandings<T extends Standing>(standings: T[]): T[] {
  return [...standings].sort(
    (a, b) => b.meters - a.meters || b.runs - a.runs || a.name.localeCompare(b.name),
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

/** A run can be edited by its owner until that month's wheel has been spun. */
export function canEditRun(opts: { isOwner: boolean; monthSpun: boolean }): boolean {
  return opts.isOwner && !opts.monthSpun;
}

/** A run date must not be in the future (allow 1 day for time zones). */
export function isValidRunDate(date: string, now: Date): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const t = Date.parse(`${date}T00:00:00Z`);
  return !Number.isNaN(t) && t <= now.getTime() + 86_400_000;
}
