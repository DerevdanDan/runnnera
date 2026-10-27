import { findMonthLoser, formatMonth, metersToKm } from "@/lib/league";
import type { StandingRow } from "@/lib/league-types";

/** A steady hue per person (from their name), used for their avatar only. */
export function playerHue(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-display text-background ${
        size === "sm" ? "h-8 w-8 text-base" : "h-11 w-11 text-xl"
      }`}
      style={{ background: `oklch(0.78 0.12 ${playerHue(name)})` }}
      aria-hidden
    >
      {name[0]}
    </div>
  );
}

export function Leaderboard({ standings, meId }: { standings: StandingRow[]; meId: string | null }) {
  const racing = standings.filter((s) => s.counts);
  const newcomers = standings.filter((s) => !s.counts);
  const loser = findMonthLoser(standings);
  const top = Math.max(1, ...standings.map((s) => s.meters));

  return (
    <div>
      <ol className="flex flex-col gap-3">
        {racing.map((s, i) => {
          const last = racing.length > 1 && s.playerId === loser?.playerId;
          return (
            <li
              key={s.playerId}
              className={`relative overflow-hidden rounded-2xl border bg-card/80 p-4 ${
                last ? "border-destructive/60" : "border-border"
              }`}
            >
              <div
                aria-hidden
                className={`absolute inset-y-0 left-0 ${last ? "bg-destructive/15" : "bg-primary/12"}`}
                style={{ width: `${(s.meters / top) * 100}%` }}
              />
              <div className="relative flex items-center gap-4">
                <span className="w-7 font-display text-4xl text-muted-foreground">{i + 1}</span>
                <Avatar name={s.name} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-3xl leading-none tracking-wide">
                    {s.name}
                    {s.playerId === meId && <span className="ml-2 align-middle text-base text-primary">you</span>}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.runs} {s.runs === 1 ? "run" : "runs"}
                    {last && <span className="font-semibold text-destructive"> · spinning right now</span>}
                  </p>
                </div>
                <p className="font-display text-5xl leading-none tabular-nums">
                  {metersToKm(s.meters).toFixed(1)}
                  <span className="ml-1 text-xl text-muted-foreground">km</span>
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {newcomers.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            New: warming up, can't come last until {formatMonth(newcomers[0]!.countsFrom).split(" ")[0]}
          </p>
          <ul className="flex flex-col gap-2">
            {newcomers.map((s) => (
              <li key={s.playerId} className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-2.5">
                <Avatar name={s.name} size="sm" />
                <p className="flex-1 font-display text-2xl leading-none tracking-wide">
                  {s.name}
                  {s.playerId === meId && <span className="ml-2 align-middle text-sm text-primary">you</span>}
                </p>
                <p className="font-display text-3xl leading-none tabular-nums text-muted-foreground">
                  {metersToKm(s.meters).toFixed(1)}
                  <span className="ml-1 text-base">km</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
