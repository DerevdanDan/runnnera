import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/league/Leaderboard";
import { ProofUpload, ProofView } from "@/components/league/Proof";
import { formatMonth } from "@/lib/league";
import { historyQuery } from "@/lib/queries";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Hall of shame — Last Place Spins" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(historyQuery),
  component: History,
});

function History() {
  const { data } = useSuspenseQuery(historyQuery);
  return (
    <main className="mx-auto max-w-3xl px-5 py-8 md:py-10">
      <h1 className="font-display text-6xl leading-none md:text-7xl">Hall of shame</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Every month's last place, the punishment the wheel gave them, and the proof they did it.
      </p>

      {data.months.length === 0 ? (
        <p className="panel mt-8 p-6 text-sm text-muted-foreground">
          Nobody has spun the wheel yet. The first verdict lands at the start of next month.
        </p>
      ) : (
        <ol className="mt-8 flex flex-col gap-6">
          {data.months.map((m) => (
            <li key={m.month} className="panel p-6">
              <p className="font-display text-lg tracking-[0.25em] text-destructive">{formatMonth(m.month)}</p>
              <div className="mt-2 flex items-center gap-3">
                {m.loser && <Avatar name={m.loser.name} />}
                <div>
                  <p className="font-display text-4xl leading-none">{m.loser?.name ?? "?"} came last</p>
                  <p className="mt-1 text-sm text-muted-foreground">{m.loserKm.toFixed(1)} km that month</p>
                </div>
              </div>

              {m.punishment && (
                <div className="mt-5 rounded-xl bg-gradient-primary p-5 text-primary-foreground">
                  <p className="text-xs font-semibold uppercase tracking-widest opacity-80">The wheel said</p>
                  <p className="mt-1 font-display text-3xl leading-tight">{m.punishment.text}</p>
                  <p className="mt-1 text-xs opacity-80">Written by {m.punishment.author}</p>
                </div>
              )}

              <div className="mt-5 flex flex-col gap-3">
                {m.proof ? (
                  <ProofView proof={m.proof} label={`Proof of ${m.loser?.name}'s punishment`} />
                ) : (
                  <p className="text-sm text-muted-foreground">No proof yet. We're waiting, {m.loser?.name}.</p>
                )}
                {m.canAddProof && (
                  <div>
                    <ProofUpload month={m.month} hasProof={!!m.proof} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
