import { metersToKm } from "@/lib/league";
import type { StandingRow } from "@/lib/league-types";

export function Leaderboard({ standings, meId }: { standings: StandingRow[]; meId: string }) {
  const top = Math.max(1, ...standings.map((s) => s.meters));
  return (
    <ol className="flex flex-col gap-3">
      {standings.map((s, i) => {
        const last = standings.length > 1 && i === standings.length - 1;
        return (
          <li
            key={s.playerId}
            className={`relative overflow-hidden rounded-xl border bg-card p-4 ${
              last ? "border-destructive/60" : "border-border"
            }`}
          >
            <div
              aria-hidden
              className={`absolute inset-y-0 left-0 ${last ? "bg-destructive/15" : "bg-primary/15"}`}
              style={{ width: `${(s.meters / top) * 100}%` }}
            />
            <div className="relative flex items-center gap-4">
              <span className="w-8 font-display text-4xl text-muted-foreground">{i + 1}</span>
              
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary font-display text-xl">
                  {s.name[0]}
                </div>
              
              <div className="min-w-0 flex-1">
                <p className="font-display text-3xl leading-none tracking-wide">
                  {s.name}
                  {s.playerId === meId && <span className="ml-2 align-middle text-base text-primary">you</span>}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.runs} {s.runs === 1 ? "run" : "runs"}
                  {last && " · currently spinning"}
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
      {standings.length < 3 && (
        <li className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Waiting for {3 - standings.length} more {standings.length === 2 ? "runner" : "runners"} to join.
        </li>
      )}
    </ol>
  );
}
