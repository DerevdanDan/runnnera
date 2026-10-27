import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { toast } from "sonner";
import { MAX_PUNISHMENTS_PER_MONTH, findMonthLoser, formatMonth, metersToKm } from "@/lib/league";
import type { PunishmentRow, StandingRow } from "@/lib/league-types";
import { deletePunishment } from "@/lib/league.functions";
import { Wheel } from "./Wheel";

/** This month's wheel, always on show: who would spin right now, and every punishment on it. */
export function MonthWheel({
  month,
  standings,
  punishments,
  meId,
  children,
}: {
  month: string;
  standings: StandingRow[];
  punishments: PunishmentRow[];
  meId: string | null;
  /** Shown under the list, e.g. the form for adding your own. */
  children?: ReactNode;
}) {
  const remove = useServerFn(deletePunishment);
  const qc = useQueryClient();
  const loser = findMonthLoser(standings);
  const people = [...standings]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => ({ ...s, items: punishments.filter((p) => p.playerId === s.playerId) }));

  const onRemove = async (p: PunishmentRow) => {
    if (p.playerId !== meId && !confirm(`Remove "${p.text}" (by ${p.author}) from the wheel?`)) return;
    try {
      await remove({ data: { id: p.id } });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove it");
    }
  };

  return (
    <section className="panel p-6">
      <p className="font-display text-lg tracking-[0.25em] text-destructive">{formatMonth(month)} wheel</p>

      {loser && (
        <div className="mt-3 text-center">
          <p className="font-display text-6xl leading-none">{loser.playerId === meId ? "You" : loser.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            last place right now · {metersToKm(loser.meters).toFixed(1)} km
          </p>
        </div>
      )}

      <div className="mt-4">
        <Wheel slices={punishments} targetId={null} spinning={false} />
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Whoever is last when {formatMonth(month).split(" ")[0]} ends spins it.
      </p>

      <div className="mt-6 flex flex-col gap-4 border-t border-border pt-4">
        {people.map((o) => (
          <div key={o.playerId}>
            <h3 className="flex items-baseline justify-between text-sm font-semibold">
              <span>
                {o.name}
                {o.playerId === meId && <span className="ml-1 text-xs font-normal text-primary">you</span>}
              </span>
              <span
                className={`text-xs ${o.items.length >= MAX_PUNISHMENTS_PER_MONTH ? "text-accent" : "text-muted-foreground"}`}
              >
                {o.items.length}/{MAX_PUNISHMENTS_PER_MONTH}
              </span>
            </h3>
            {o.items.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <ul className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground">
                {o.items.map((p) => (
                  <li key={p.id} className="flex items-start gap-2">
                    <span className="flex-1">· {p.text}</span>
                    {p.canDelete && (
                      <button
                        aria-label={`Remove "${p.text}"`}
                        className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                        onClick={() => onRemove(p)}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {children}
    </section>
  );
}
