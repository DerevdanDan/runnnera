// Pure, browser-safe league rules shared by server and UI.

export const PLAYER_NAMES = ["Alvaro", "Daniil", "Mario"] as const;
export const MAX_PUNISHMENTS_PER_MONTH = 3;
export const MAX_PUNISHMENT_LENGTH = 140;
export const RUN_SPORT_TYPES = ["Run", "TrailRun", "VirtualRun"] as const;

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

export type StravaActivityLite = {
  sport_type?: string;
  type?: string;
  distance: number; // meters
  start_date_local: string; // e.g. "2026-10-05T07:00:00Z"
};

export function isRun(a: StravaActivityLite): boolean {
  const t = a.sport_type ?? a.type ?? "";
  return (RUN_SPORT_TYPES as readonly string[]).includes(t);
}

/** Total running meters and run count for activities whose local start falls in `month`. */
export function sumRunsForMonth(
  activities: StravaActivityLite[],
  month: string,
): { meters: number; runs: number } {
  let meters = 0;
  let runs = 0;
  for (const a of activities) {
    if (!isRun(a)) continue;
    if (a.start_date_local.slice(0, 7) !== month) continue;
    meters += a.distance;
    runs += 1;
  }
  return { meters, runs };
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
