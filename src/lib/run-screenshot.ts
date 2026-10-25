// Pulls distance, duration and date out of the text OCR'd from a Strava or Garmin screenshot.
// Pure and browser-safe so it can be unit tested; the OCR itself lives in RunForm's reader.

export type ScreenshotStats = { km: number | null; seconds: number | null; date: string | null };

const MI_TO_KM = 1.609344;
const MIN_PACE = 150; // 2:30 /km — faster than that is not a run
const MAX_PACE = 900; // 15:00 /km

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, ene: 1, enero: 1,
  feb: 2, february: 2, febrero: 2,
  mar: 3, march: 3, marzo: 3,
  apr: 4, april: 4, abr: 4, abril: 4,
  may: 5, mayo: 5,
  jun: 6, june: 6, junio: 6,
  jul: 7, july: 7, julio: 7,
  aug: 8, august: 8, ago: 8, agosto: 8,
  sep: 9, sept: 9, september: 9, septiembre: 9, set: 9, setiembre: 9,
  oct: 10, october: 10, octubre: 10,
  nov: 11, november: 11, noviembre: 11,
  dec: 12, december: 12, dic: 12, diciembre: 12,
};
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

/** Fix the OCR slips that matter for numbers: "1O.2" → "10.2", "5,2" stays (handled later). */
function normalize(text: string): string {
  return text
    .replace(/(?<=\d)[oO](?=[\d.,:\s]|km)/g, "0")
    .replace(/(?<=[.,:])[oO](?=\d)/g, "0")
    .replace(/(?<=\d)[lI|](?=\d)/g, "1")
    .replace(/[“”″]/g, '"')
    .replace(/[‘’′]/g, "'");
}

function around(text: string, start: number, end: number, reach = 40): string {
  return text.slice(Math.max(0, start - reach), end + reach).toLowerCase();
}

function findKm(text: string): number | null {
  const re = /(?<![\d:.,/'"])(\d{1,3}(?:[.,]\d{1,3})?)\s*(km|krn|kms|kil[oó]met(?:er|re|ro)s?|mi|miles?)\b(?!\s*\/)/gi;
  let best: { km: number; labelled: boolean } | null = null;
  for (const m of text.matchAll(re)) {
    const unit = m[2]!.toLowerCase();
    const value = Number(m[1]!.replace(",", "."));
    const km = unit.startsWith("mi") ? value * MI_TO_KM : value;
    if (!(km > 0 && km <= 200)) continue;
    const labelled = /distan|dist\b/.test(around(text, m.index!, m.index! + m[0].length));
    // A labelled distance wins; otherwise the biggest one (splits and laps are smaller than the total).
    if (!best || (labelled && !best.labelled) || (labelled === best.labelled && km > best.km)) best = { km, labelled };
  }
  return best ? Math.round(best.km * 100) / 100 : null;
}

type Duration = { seconds: number; index: number; score: number };

// Longer phrases first, so "elapsed time" isn't read as plain "time".
const LABELS =
  /moving time|tiempo en movimiento|elapsed time|tiempo transcurrido|total time|tiempo total|duration|duraci[oó]n|time|tiempo|avg pace|pace|ritmo medio|ritmo|splits?|laps?|vueltas?|parciales/g;

function labelScore(label: string): number {
  if (/moving|movimiento/.test(label)) return 3;
  if (/elapsed|transcurrido|total/.test(label)) return 1;
  if (/pace|ritmo|split|lap|vuelta|parcial/.test(label)) return -3;
  return 2; // time, tiempo, duration
}

/** Score a number by the label closest to it: Strava puts labels above values, Garmin below. */
function nearestLabelScore(text: string, start: number, end: number): number {
  const from = Math.max(0, start - 40);
  const window = text.slice(from, end + 40).toLowerCase();
  let best: { gap: number; score: number } | null = null;
  for (const m of window.matchAll(LABELS)) {
    const s = from + m.index!;
    const e = s + m[0].length;
    const gap = e <= start ? start - e : s >= end ? s - end : 0;
    if (!best || gap < best.gap) best = { gap, score: labelScore(m[0]) };
  }
  return best?.score ?? 0;
}

function durationCandidates(text: string): Duration[] {
  const out: Duration[] = [];
  const push = (seconds: number, index: number, length: number) => {
    if (seconds <= 0 || seconds > 24 * 3600) return;
    out.push({ seconds, index, score: nearestLabelScore(text, index, index + length) });
  };

  // 1:02:15 and 52:10 — but not paces (5:12 /km), clock times (7:30 AM, at 07:30) or parts of longer numbers.
  const clock = /(?<![\d:.,])(\d{1,3}):([0-5]\d)(?::([0-5]\d))?(?![\d:])(?!\s*(?:\/|min\s*\/|[ap]\.?m\b|h\b))/gi;
  for (const m of text.matchAll(clock)) {
    const before = text.slice(Math.max(0, m.index! - 8), m.index!).toLowerCase();
    if (/(\bat|a las|@|,)\s*$/.test(before)) continue;
    const [a, b, c] = [Number(m[1]), Number(m[2]), m[3] === undefined ? null : Number(m[3])];
    push(c === null ? a * 60 + b : a * 3600 + b * 60 + c, m.index!, m[0].length);
  }

  // 1h 2m, 52m 10s, 52 min — a lone "45 m" is elevation, so it needs an h, an s or "min".
  const words = /(?<![\d.,])(?:(\d{1,2})\s*h(?:rs?)?\s*)?(\d{1,3})\s*(m(?![a-z])|min\b)\s*(?:(\d{1,2})\s*s\b)?/gi;
  for (const m of text.matchAll(words)) {
    const [h, mins, unit, s] = [m[1], m[2], m[3]!, m[4]];
    if (h === undefined && s === undefined && unit.toLowerCase() === "m") continue;
    push(Number(h ?? 0) * 3600 + Number(mins) * 60 + Number(s ?? 0), m.index!, m[0].length);
  }
  return out;
}

function findSeconds(text: string, km: number | null): number | null {
  let candidates = durationCandidates(text);
  if (km) {
    const plausible = candidates.filter((c) => c.seconds / km >= MIN_PACE && c.seconds / km <= MAX_PACE);
    if (plausible.length) candidates = plausible;
    else return null;
  }
  candidates = candidates.filter((c) => c.score >= 0);
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  return candidates[0]!.seconds;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function validDate(y: number, m: number, d: number, now: Date, yearGiven: boolean): string | null {
  let date = new Date(y, m - 1, d);
  if (date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  // "Oct 24" without a year in January means last October.
  if (!yearGiven && date.getTime() > now.getTime() + 86_400_000) date = new Date(y - 1, m - 1, d);
  if (date.getTime() > now.getTime() + 86_400_000) return null;
  return ymd(date);
}

function findDate(text: string, now: Date): string | null {
  const lower = text.toLowerCase();
  const thisYear = now.getFullYear();

  // October 24, 2026 / Oct 24 / Saturday, October 24
  for (const m of lower.matchAll(new RegExp(`\\b(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`, "g"))) {
    const d = validDate(Number(m[3] ?? thisYear), MONTHS[m[1]!]!, Number(m[2]), now, !!m[3]);
    if (d) return d;
  }
  // 24 October 2026 / 24 de octubre de 2026 / 24 oct
  for (const m of lower.matchAll(new RegExp(`\\b(\\d{1,2})\\.?\\s+(?:de\\s+)?(${MONTH_RE})\\.?\\b(?:,?\\s+(?:de\\s+)?(\\d{4}))?`, "g"))) {
    const d = validDate(Number(m[3] ?? thisYear), MONTHS[m[2]!]!, Number(m[1]), now, !!m[3]);
    if (d) return d;
  }
  // 2026-10-24
  for (const m of lower.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    const d = validDate(Number(m[1]), Number(m[2]), Number(m[3]), now, true);
    if (d) return d;
  }
  // 24/10/2026 or 10/24/2026 — only when the day is obvious (> 12)
  for (const m of lower.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g)) {
    const [a, b, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const d = a > 12 ? validDate(y, b, a, now, true) : b > 12 ? validDate(y, a, b, now, true) : null;
    if (d) return d;
  }
  if (/\b(today|hoy)\b/.test(lower)) return ymd(now);
  if (/\b(yesterday|ayer)\b/.test(lower)) return ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  return null;
}

export function parseRunScreenshot(rawText: string, now: Date): ScreenshotStats {
  const text = normalize(rawText);
  const km = findKm(text);
  return { km, seconds: findSeconds(text, km), date: findDate(text, now) };
}
