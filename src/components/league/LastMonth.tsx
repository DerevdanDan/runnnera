import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatMonth, metersToKm } from "@/lib/league";
import type { LastMonthResult } from "@/lib/league-types";
import { deletePunishment, spinWheel } from "@/lib/league.functions";
import { ProofUpload, ProofView } from "./Proof";
import { Wheel } from "./Wheel";

export function LastMonth({ result, meId }: { result: LastMonthResult; meId: string }) {
  const spin = useServerFn(spinWheel);
  const remove = useServerFn(deletePunishment);
  const qc = useQueryClient();
  const [target, setTarget] = useState<string | null>(result.spin?.punishmentId ?? null);
  const [spinning, setSpinning] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);

  const loserIsMe = result.loser?.playerId === meId;
  const loserKm = result.standings.find((s) => s.playerId === result.loser?.playerId);
  const landed = revealed ?? (result.spin ? result.spin.punishmentId : null);
  const landedSlice = result.wheel.find((w) => w.id === landed);

  return (
    <section className="panel border-destructive/40 p-6">
      <p className="font-display text-lg tracking-[0.25em] text-destructive">{formatMonth(result.month)} verdict</p>
      {result.loser ? (
        <h2 className="mt-1 font-display text-5xl leading-none">
          {loserIsMe ? "You" : result.loser.name} came last
          {loserKm && (
            <span className="ml-3 text-2xl text-muted-foreground">{metersToKm(loserKm.meters).toFixed(1)} km</span>
          )}
        </h2>
      ) : (
        <h2 className="mt-1 font-display text-5xl">No result</h2>
      )}

      {result.wheel.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No punishments were set for {formatMonth(result.month)}, so nobody spins this time.
        </p>
      ) : (
        <div className="mt-6 grid items-center gap-8 md:grid-cols-[minmax(0,340px)_1fr]">
          <Wheel
            slices={result.wheel}
            targetId={target}
            spinning={spinning}
            onSpinEnd={() => {
              setSpinning(false);
              setRevealed(target);
              qc.invalidateQueries({ queryKey: ["dashboard"] });
            }}
          />
          <div>
            {landedSlice && !spinning ? (
              <div className="rounded-xl bg-gradient-primary p-5 text-primary-foreground shadow-glow">
                <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
                  {loserIsMe ? "Your" : `${result.loser?.name}'s`} punishment
                </p>
                <p className="mt-2 font-display text-4xl leading-tight">{landedSlice.text}</p>
                <p className="mt-2 text-xs opacity-80">Written by {landedSlice.author}</p>
                {result.spin && (result.spin.proof || result.canAddProof) && (
                  <div className="mt-4 flex flex-col gap-3 text-foreground">
                    {result.spin.proof ? (
                      <ProofView proof={result.spin.proof} label={`Proof of ${result.loser?.name}'s punishment`} />
                    ) : null}
                    {result.canAddProof && <ProofUpload month={result.month} hasProof={!!result.spin.proof} />}
                  </div>
                )}
              </div>
            ) : result.canSpin ? (
              <div>
                <p className="text-muted-foreground">
                  {result.wheel.length} punishments loaded. No backing out.
                  {!loserIsMe && ` ${result.loser?.name} hasn't spun yet, so you can spin for them.`}
                </p>
                <Button
                  size="lg"
                  disabled={spinning}
                  className="mt-4 h-14 bg-gradient-primary px-10 font-display text-2xl tracking-wider shadow-glow"
                  onClick={async () => {
                    try {
                      const { punishmentId } = await spin();
                      setTarget(punishmentId);
                      setSpinning(true);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "The wheel got stuck");
                    }
                  }}
                >
                  {spinning ? "Spinning…" : loserIsMe ? "Spin the wheel" : `Spin for ${result.loser?.name}`}
                </Button>
              </div>
            ) : spinning ? (
              <p className="font-display text-3xl">Spinning…</p>
            ) : (
              <p className="text-muted-foreground">
                Waiting for {result.loser?.name ?? "last place"} to spin the wheel.
              </p>
            )}
            <ul className="mt-6 flex flex-col gap-1 text-sm text-muted-foreground">
              {result.wheel.map((w) => (
                <li
                  key={w.id}
                  className={`flex items-start gap-2 ${w.id === landed && !spinning ? "font-semibold text-foreground" : ""}`}
                >
                  <span className="flex-1">
                    · {w.text} <span className="opacity-60">— {w.author}</span>
                  </span>
                  {w.canDelete && !spinning && (
                    <button
                      aria-label={`Remove "${w.text}"`}
                      className="rounded p-0.5 hover:text-destructive"
                      onClick={async () => {
                        if (!confirm(`Remove "${w.text}" (by ${w.author}) from the wheel?`)) return;
                        try {
                          await remove({ data: { id: w.id } });
                          await qc.invalidateQueries({ queryKey: ["dashboard"] });
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Couldn't remove it");
                        }
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
