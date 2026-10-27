import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/league/Leaderboard";
import { formatMonth } from "@/lib/league";
import type { StatsRow } from "@/lib/league-types";
import { statsQuery } from "@/lib/queries";

export const Route = createFileRoute("/stats")({
  head: () => ({ meta: [{ title: "Stats — Runnnera" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(statsQuery),
  component: Stats,
});

const shortDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function StatTile({ label, value, unit, hint }: { label: string; value: string; unit?: string; hint?: string }) {
  return (
    <div className="panel p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-5xl leading-none tabular-nums">
        {value}
        {unit && <span className="ml-1.5 text-xl text-muted-foreground">{unit}</span>}
      </p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Km per week, one series: earlier weeks muted, this week in full orange, hover for the exact number. */
function WeeklyBars({ name, values, weekStarts }: { name: string; values: number[]; weekStarts: string[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...values);
  const last = values.length - 1;
  return (
    <div className="mt-5">
      <p className="text-xs text-muted-foreground">Km per week</p>
      <div className="relative mt-2" role="img" aria-label={`${name}'s km per week: ${values.join(", ")}`}>
        {active !== null && (
          <div
            className="pointer-events-none absolute -top-9 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs shadow"
            style={{ left: `${((active + 0.5) / values.length) * 100}%` }}
          >
            Week of {shortDate(weekStarts[active]!)} · <span className="font-semibold">{values[active]!.toFixed(1)} km</span>
          </div>
        )}
        <div className="flex h-24 items-end gap-[2px] border-b border-border">
          {values.map((v, i) => (
            <button
              key={weekStarts[i]}
              type="button"
              className="relative flex h-full flex-1 items-end justify-center focus:outline-none"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onClick={() => setActive(active === i ? null : i)}
              aria-label={`Week of ${shortDate(weekStarts[i]!)}: ${v.toFixed(1)} km`}
            >
              {i === last && v > 0 && (
                <span className="absolute text-xs font-semibold tabular-nums" style={{ bottom: `calc(${(v / max) * 100}% + 4px)` }}>
                  {v.toFixed(1)}
                </span>
              )}
              <span
                className={`block w-full max-w-6 rounded-t-[4px] ${i === last ? "bg-primary" : "bg-primary/40"} ${
                  active === i ? "brightness-125" : ""
                }`}
                style={{ height: v > 0 ? `max(2px, ${(v / max) * 100}%)` : "0" }}
              />
            </button>
          ))}
        </div>
        <div className="mt-1 flex gap-[2px]">
          {weekStarts.map((w, i) => (
            <span key={w} className={`flex-1 text-center text-[10px] ${i === last ? "text-foreground" : "text-muted-foreground"}`}>
              {i === last ? "This wk" : shortDate(w)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PersonCard({ row, weekStarts }: { row: StatsRow; weekStarts: string[] }) {
  return (
    <li className="panel p-5">
      <div className="flex items-center gap-3">
        <Avatar name={row.name} />
        <p className="font-display text-3xl leading-none tracking-wide">{row.name}</p>
        {!row.counts && (
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">new</span>
        )}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Average per day this month</p>
      <p className="font-display text-6xl leading-none tabular-nums">
        {row.avgKmPerDay.toFixed(2)}
        <span className="ml-1.5 text-xl text-muted-foreground">km/day</span>
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-muted-foreground">This month</dt>
          <dd className="font-semibold tabular-nums">
            {row.monthKm.toFixed(1)} km · {row.monthRuns} {row.monthRuns === 1 ? "run" : "runs"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Longest run</dt>
          <dd className="font-semibold tabular-nums">{row.longestKm.toFixed(1)} km</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Streak</dt>
          <dd className="font-semibold tabular-nums">
            {row.weekStreak} {row.weekStreak === 1 ? "week" : "weeks"} in a row
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">All time</dt>
          <dd className="font-semibold tabular-nums">{row.totalKm.toFixed(1)} km</dd>
        </div>
      </dl>
      <WeeklyBars name={row.name} values={row.weeklyKm} weekStarts={weekStarts} />
    </li>
  );
}

function Stats() {
  const { data } = useSuspenseQuery(statsQuery);
  const [y, m] = data.month.split("-").map(Number) as [number, number];
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const best = [...data.rows].sort((a, b) => b.weekStreak - a.weekStreak || b.monthKm - a.monthKm)[0];

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 md:py-10">
      <h1 className="font-display text-6xl leading-none md:text-7xl">Stats</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {formatMonth(data.month)} so far: day {data.daysSoFar} of {daysInMonth}.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Team km this month" value={data.groupMonthKm.toFixed(1)} unit="km" />
        <StatTile
          label="Team average per day"
          value={data.groupAvgKmPerDay.toFixed(2)}
          unit="km/day"
          hint="Everyone's km this month ÷ days so far"
        />
        <StatTile
          label="Most consistent"
          value={best && best.weekStreak > 0 ? best.name : "—"}
          hint={
            best && best.weekStreak > 0
              ? `${best.weekStreak} ${best.weekStreak === 1 ? "week" : "weeks"} in a row with a run`
              : "Nobody has a streak going yet"
          }
        />
      </div>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.rows.map((r) => (
          <PersonCard key={r.playerId} row={r} weekStarts={data.weekStarts} />
        ))}
      </ul>

      <section className="panel mt-10 overflow-x-auto p-5">
        <h2 className="font-display text-3xl tracking-wide">All the numbers</h2>
        <table className="mt-3 w-full min-w-[560px] text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2 font-normal">Runner</th>
              <th className="py-2 text-right font-normal">Km/day</th>
              <th className="py-2 text-right font-normal">This month</th>
              <th className="py-2 text-right font-normal">Runs</th>
              <th className="py-2 text-right font-normal">Longest</th>
              <th className="py-2 text-right font-normal">Streak</th>
              <th className="py-2 text-right font-normal">All time</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {data.rows.map((r) => (
              <tr key={r.playerId} className="border-b border-border/60 last:border-0">
                <td className="py-2 font-semibold">{r.name}</td>
                <td className="py-2 text-right">{r.avgKmPerDay.toFixed(2)}</td>
                <td className="py-2 text-right">{r.monthKm.toFixed(1)} km</td>
                <td className="py-2 text-right">{r.monthRuns}</td>
                <td className="py-2 text-right">{r.longestKm.toFixed(1)} km</td>
                <td className="py-2 text-right">{r.weekStreak} wk</td>
                <td className="py-2 text-right">{r.totalKm.toFixed(1)} km</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
