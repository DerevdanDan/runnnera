import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { claimPlayer, signOut } from "@/lib/league.functions";

export function ClaimName({
  athleteName,
  openSlots,
}: {
  athleteName: string;
  openSlots: { id: string; name: string }[];
}) {
  const claim = useServerFn(claimPlayer);
  const logout = useServerFn(signOut);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <p className="font-display text-xl tracking-[0.3em] text-primary">Strava connected</p>
      <h1 className="mt-2 font-display text-6xl text-foreground">Hey {athleteName}, who are you?</h1>
      {openSlots.length === 0 ? (
        <p className="mt-6 text-muted-foreground">
          All three spots in this league are already taken by other Strava accounts.
        </p>
      ) : (
        <>
          <p className="mt-4 text-muted-foreground">Pick your name once — it stays linked to this Strava account.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {openSlots.map((slot) => (
              <Button
                key={slot.id}
                variant="secondary"
                disabled={busy !== null}
                className="h-20 font-display text-3xl tracking-wide hover:bg-primary hover:text-primary-foreground"
                onClick={async () => {
                  setBusy(slot.id);
                  try {
                    await claim({ data: { playerId: slot.id } });
                    await qc.invalidateQueries({ queryKey: ["dashboard"] });
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Couldn't save that");
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {busy === slot.id ? "…" : slot.name}
              </Button>
            ))}
          </div>
        </>
      )}
      <button
        className="mt-10 self-start text-sm text-muted-foreground underline-offset-4 hover:underline"
        onClick={async () => {
          await logout();
          await qc.invalidateQueries({ queryKey: ["dashboard"] });
        }}
      >
        Not you? Sign out
      </button>
    </main>
  );
}
