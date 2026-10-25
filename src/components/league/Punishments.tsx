import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_PUNISHMENTS_PER_MONTH, MAX_PUNISHMENT_LENGTH, formatMonth } from "@/lib/league";
import type { PunishmentRow, StandingRow } from "@/lib/league-types";
import { addPunishment, deletePunishment } from "@/lib/league.functions";

export function Punishments({
  month,
  meId,
  punishments,
  people,
}: {
  month: string;
  meId: string;
  punishments: PunishmentRow[];
  /** Everyone in the league, so people who haven't added any yet still show up. */
  people: Pick<StandingRow, "playerId" | "name">[];
}) {
  const add = useServerFn(addPunishment);
  const remove = useServerFn(deletePunishment);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const mine = punishments.filter((p) => p.playerId === meId);
  const remaining = MAX_PUNISHMENTS_PER_MONTH - mine.length;
  const others = people
    .filter((p) => p.playerId !== meId)
    .map((p) => ({ ...p, items: punishments.filter((x) => x.playerId === p.playerId) }));

  const refresh = () => qc.invalidateQueries({ queryKey: ["dashboard"] });

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-display text-4xl tracking-wide">Punishments</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Everyone adds {MAX_PUNISHMENTS_PER_MONTH} for {formatMonth(month)}. They all go on the wheel, yours
        included.
      </p>

      <h3 className="mt-5 text-sm font-semibold">Yours</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {mine.map((p, i) => (
          <li key={p.id} className="flex items-center gap-3 rounded-lg bg-secondary px-4 py-3">
            <span className="font-display text-2xl text-primary">{i + 1}</span>
            <span className="flex-1 text-sm">{p.text}</span>
            <button
              aria-label="Remove punishment"
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              onClick={async () => {
                try {
                  await remove({ data: { id: p.id } });
                  await refresh();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Couldn't remove it");
                }
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      {remaining > 0 ? (
        <form
          className="mt-3 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim()) return;
            setBusy(true);
            try {
              await add({ data: { text: text.trim() } });
              setText("");
              await refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Couldn't add it");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Input
            value={text}
            maxLength={MAX_PUNISHMENT_LENGTH}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Buy everyone's coffee for a week"
            className="h-11"
          />
          <Button type="submit" disabled={busy || !text.trim()} className="h-11">
            Add ({remaining} left)
          </Button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-accent">All 3 in. Now go run.</p>
      )}

      <div className="mt-6 flex flex-col gap-4 border-t border-border pt-4">
        {others.map((o) => (
          <div key={o.playerId}>
            <h3 className="flex items-baseline justify-between text-sm font-semibold">
              {o.name}
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
                  <li key={p.id}>· {p.text}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
