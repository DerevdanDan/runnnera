import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMonth, nextMonthKey } from "@/lib/league";
import type { Person } from "@/lib/league-types";
import { addPlayer, resetPlayerLogin, updatePlayer } from "@/lib/league.functions";
import { Avatar } from "./Leaderboard";

const monthName = (m: string) => formatMonth(m).split(" ")[0];

/** Admin panel: add people, share the invite link, lock names to a Gmail, and handle newcomers. */
export function AddPlayer({ people, meId, month }: { people: Person[]; meId: string; month: string }) {
  const add = useServerFn(addPlayer);
  const update = useServerFn(updatePlayer);
  const reset = useServerFn(resetPlayerLogin);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [locking, setLocking] = useState<{ id: string; email: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries();
  const next = nextMonthKey(month);

  const run = async (action: () => Promise<unknown>, done?: string) => {
    try {
      await action();
      if (done) toast.success(done);
      await refresh();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      return false;
    }
  };

  return (
    <section className="panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-4xl tracking-wide">People</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add someone, then send them the link. They sign in with Google and pick their name, or land on it
            straight away if you lock it to their Gmail.
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
        {people.map((p) => {
          const isNew = p.countsFrom > month;
          const joinedThisMonth = p.countsFrom === month;
          return (
            <li key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={p.name} size="sm" />
                <div className="min-w-0">
                  <p className="font-semibold">
                    {p.name}
                    {p.isAdmin && <span className="ml-2 text-xs font-normal text-primary">admin</span>}
                    {isNew && (
                      <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-normal text-accent">
                        new · counts from {monthName(p.countsFrom)}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.claimed
                      ? (p.email ?? "Signed in with Google")
                      : p.inviteEmail
                        ? <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Only {p.inviteEmail} can take this name</span>
                        : "Hasn't signed in yet · anyone with the link can take this name"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 sm:justify-end">
                {(isNew || joinedThisMonth) && !p.isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() =>
                      run(
                        () => update({ data: { playerId: p.id, countsThisMonth: isNew } }),
                        isNew ? `${p.name} counts in ${monthName(month)} too` : `${p.name} starts in ${monthName(next)}`,
                      )
                    }
                  >
                    {isNew ? `Count ${monthName(month)} too` : `Start in ${monthName(next)} instead`}
                  </Button>
                )}
                {!p.claimed &&
                  (locking?.id === p.id ? (
                    <form
                      className="flex gap-1.5"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (await run(() => update({ data: { playerId: p.id, inviteEmail: locking.email || null } }), "Saved"))
                          setLocking(null);
                      }}
                    >
                      <Input
                        autoFocus
                        type="email"
                        placeholder="their@gmail.com"
                        value={locking.email}
                        onChange={(e) => setLocking({ id: p.id, email: e.target.value })}
                        className="h-8 w-48"
                      />
                      <Button size="sm" type="submit">Save</Button>
                    </form>
                  ) : p.inviteEmail ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => run(() => update({ data: { playerId: p.id, inviteEmail: null } }), "Lock removed")}
                    >
                      Remove lock
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => setLocking({ id: p.id, email: "" })}
                    >
                      Lock to Gmail
                    </Button>
                  ))}
                {p.claimed && p.id !== meId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => {
                      if (!confirm(`Sign ${p.name} out and free up the name, so they (or someone else) can pick it again?`)) return;
                      void run(() => reset({ data: { playerId: p.id } }), `${p.name} can pick their name again`);
                    }}
                  >
                    Reset sign-in
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const ok = await run(
            () => add({ data: { name, email: email.trim() || null } }),
            `${name.trim()} joined. They count from ${monthName(next)}.`,
          );
          if (ok) {
            setName("");
            setEmail("");
          }
          setBusy(false);
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="Name" className="sm:max-w-48" />
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Their Gmail (optional, locks the name)"
          className="sm:max-w-72"
        />
        <Button type="submit" disabled={!name.trim() || busy}>{busy ? "Adding…" : "Add"}</Button>
      </form>
    </section>
  );
}
