import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_PUNISHMENTS_PER_MONTH, MAX_PUNISHMENT_LENGTH, formatMonth } from "@/lib/league";
import { addPunishment } from "@/lib/league.functions";

/** Form for adding your own punishments; the full list lives under the wheel. */
export function Punishments({ month, mineCount }: { month: string; mineCount: number }) {
  const add = useServerFn(addPunishment);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const remaining = MAX_PUNISHMENTS_PER_MONTH - mineCount;

  return (
    <div className="mt-6 border-t border-border pt-4">
      <h3 className="text-sm font-semibold">Add yours</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {mineCount} of {MAX_PUNISHMENTS_PER_MONTH} added for {formatMonth(month)}. They go on the wheel straight away.
      </p>
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
              await qc.invalidateQueries({ queryKey: ["dashboard"] });
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
    </div>
  );
}
