import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_PUNISHMENTS_PER_MONTH, MAX_PUNISHMENT_LENGTH, formatMonth } from "@/lib/league";
import { addPunishment, deletePunishment } from "@/lib/league.functions";

export function Punishments({
  month,
  mine,
  counts,
}: {
  month: string;
  mine: { id: string; text: string }[];
  counts: { name: string; count: number }[];
}) {
  const add = useServerFn(addPunishment);
  const remove = useServerFn(deletePunishment);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const remaining = MAX_PUNISHMENTS_PER_MONTH - mine.length;

  const refresh = () => qc.invalidateQueries({ queryKey: ["dashboard"] });

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-display text-4xl tracking-wide">Your punishments</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Add {MAX_PUNISHMENTS_PER_MONTH} for {formatMonth(month)}. They're secret until the wheel comes out — and
        yours go on it too.
      </p>

      <ul className="mt-5 flex flex-col gap-2">
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
          className="mt-4 flex gap-2"
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
        <p className="mt-4 text-sm text-accent">All 3 in. Now go run.</p>
      )}

      <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
        {counts.map((c) => (
          <span
            key={c.name}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              c.count >= MAX_PUNISHMENTS_PER_MONTH
                ? "bg-accent text-accent-foreground"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {c.name} {c.count}/{MAX_PUNISHMENTS_PER_MONTH}
          </span>
        ))}
      </div>
    </section>
  );
}
