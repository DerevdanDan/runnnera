import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addPlayer } from "@/lib/league.functions";

export function AddPlayer() {
  const add = useServerFn(addPlayer);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-display text-3xl tracking-wide">Add someone to the challenge</h2>
      <p className="mt-1 text-sm text-muted-foreground">They'll pick a PIN the first time they sign in.</p>
      <form
        className="mt-4 flex gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await add({ data: { name } });
            toast.success(`${name.trim()} joined the challenge`);
            setName("");
            await qc.invalidateQueries({ queryKey: ["dashboard"] });
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't add them");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="Name" className="max-w-xs" />
        <Button type="submit" disabled={!name.trim() || busy}>{busy ? "Adding…" : "Add"}</Button>
      </form>
    </section>
  );
}
