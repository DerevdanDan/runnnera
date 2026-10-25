import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Person } from "@/lib/league-types";
import { addPlayer, resetPlayerLogin } from "@/lib/league.functions";

/** Admin panel: add people, share the invite link, and see who has claimed which name. */
export function AddPlayer({ people, meId }: { people: Person[]; meId: string }) {
  const add = useServerFn(addPlayer);
  const reset = useServerFn(resetPlayerLogin);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["dashboard"] });

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl tracking-wide">People</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add someone, then send them the link. They sign in with Google and pick their name.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`${window.location.origin}/`);
              toast.success("Invite link copied");
            } catch {
              toast.error(`Couldn't copy. The link is ${window.location.origin}/`);
            }
          }}
        >
          Copy invite link
        </Button>
      </div>

      <ul className="mt-4 divide-y divide-border">
        {people.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="font-semibold">
                {p.name}
                {p.isAdmin && <span className="ml-2 text-xs font-normal text-primary">admin</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {p.claimed ? (p.email ?? "Signed in with Google") : "Hasn't signed in yet"}
              </p>
            </div>
            {p.claimed && p.id !== meId && (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-muted-foreground"
                onClick={async () => {
                  if (!confirm(`Sign ${p.name} out and free up the name, so they (or someone else) can pick it again?`)) return;
                  try {
                    await reset({ data: { playerId: p.id } });
                    toast.success(`${p.name} can pick their name again`);
                    await refresh();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Couldn't reset");
                  }
                }}
              >
                Reset sign-in
              </Button>
            )}
          </li>
        ))}
      </ul>

      <form
        className="mt-4 flex gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await add({ data: { name } });
            toast.success(`${name.trim()} joined the challenge`);
            setName("");
            await refresh();
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
