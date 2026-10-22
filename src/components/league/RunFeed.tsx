import { useState } from "react";
import { Button } from "@/components/ui/button";
import { metersToKm } from "@/lib/league";
import type { FeedRun } from "@/lib/league-types";
import { RunForm } from "./RunForm";

function pace(r: FeedRun) {
  if (!r.durationSeconds) return null;
  const secPerKm = r.durationSeconds / (r.meters / 1000);
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

function duration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m} min`;
}

export function RunFeed({ feed, canLog = true }: { feed: FeedRun[]; canLog?: boolean }) {
  const [editing, setEditing] = useState<FeedRun | null>(null);
  const [adding, setAdding] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <h2 className="font-display text-5xl leading-none">Run feed</h2>
        {canLog && <Button onClick={() => setAdding(true)} className="bg-gradient-primary font-semibold shadow-glow">
          + Log a run
        </Button>}
      </div>
      {feed.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          No runs logged yet.
        </p>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {feed.map((r) => (
            <li key={r.id} className="overflow-hidden rounded-xl border border-border bg-card">
              {r.photoUrl && (
                <button type="button" className="block w-full" onClick={() => setZoom(r.photoUrl)}>
                  <img src={r.photoUrl} alt={`${r.name}'s run screenshot`} loading="lazy" className="h-56 w-full bg-secondary object-cover" />
                </button>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-2xl leading-none tracking-wide">{r.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(`${r.runDate}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}
                      {r.updatedAt !== r.createdAt && " · edited"}
                    </p>
                  </div>
                  <p className="font-display text-4xl leading-none tabular-nums">
                    {metersToKm(r.meters).toFixed(1)}
                    <span className="ml-1 text-base text-muted-foreground">km</span>
                  </p>
                </div>
                {r.durationSeconds && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {duration(r.durationSeconds)} · {pace(r)}
                  </p>
                )}
                {r.note && <p className="mt-2 text-sm">{r.note}</p>}
                {r.canEdit && (
                  <button className="mt-3 text-sm font-semibold text-primary hover:underline" onClick={() => setEditing(r)}>
                    Edit
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {adding && <RunForm open onOpenChange={setAdding} />}
      {editing && <RunForm key={editing.id} open run={editing} onOpenChange={(o) => !o && setEditing(null)} />}
      {zoom && (
        <button type="button" className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4" onClick={() => setZoom(null)}>
          <img src={zoom} alt="Run screenshot" className="max-h-full max-w-full rounded-lg object-contain" />
        </button>
      )}
    </section>
  );
}
