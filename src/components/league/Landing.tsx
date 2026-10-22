import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/league.functions";

type P = { id: string; name: string; hasPin: boolean };

export function Landing({ players }: { players: P[] }) {
  const login = useServerFn(signIn);
  const qc = useQueryClient();
  const [picked, setPicked] = useState<P | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <main className="mx-auto flex max-w-5xl flex-col justify-center px-6 py-16">
      <p className="font-display text-xl tracking-[0.3em] text-primary">Monthly running league</p>
      <h1 className="mt-3 font-display text-[clamp(4rem,14vw,10rem)] leading-[0.85] text-foreground">
        Last place
        <br />
        <span className="bg-gradient-primary bg-clip-text text-transparent">spins.</span>
      </h1>
      <p className="mt-8 max-w-xl text-lg text-muted-foreground">
        Log every run with a screenshot. Whoever has the fewest kilometres at the end of the month spins the
        wheel — loaded with punishments you all wrote.
      </p>

      <div className="mt-10 max-w-xl">
        <p className="mb-3 text-sm font-semibold">Who are you?</p>
        <div className="grid grid-cols-3 gap-3">
          {players.map((p) => (
            <Button
              key={p.id}
              variant={picked?.id === p.id ? "default" : "secondary"}
              className="h-16 font-display text-2xl tracking-wide"
              onClick={() => {
                setPicked(p);
                setPin("");
              }}
            >
              {p.name}
            </Button>
          ))}
        </div>

        {picked && (
          <form
            className="mt-6 flex flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await login({ data: { playerId: picked.id, pin } });
                await qc.invalidateQueries({ queryKey: ["dashboard"] });
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Couldn't sign in");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label htmlFor="pin" className="text-sm text-muted-foreground">
              {picked.hasPin
                ? `Enter ${picked.name}'s 4-digit PIN`
                : `First time? Choose a 4-digit PIN for ${picked.name} — you'll use it to sign in.`}
            </label>
            <div className="flex gap-3">
              <Input
                id="pin"
                inputMode="numeric"
                type="password"
                autoComplete={picked.hasPin ? "current-password" : "new-password"}
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="h-14 w-40 text-center text-2xl tracking-[0.5em]"
                autoFocus
              />
              <Button
                type="submit"
                disabled={pin.length !== 4 || busy}
                className="h-14 bg-gradient-primary px-8 text-base font-semibold shadow-glow"
              >
                {busy ? "…" : picked.hasPin ? "Sign in" : "Set PIN & join"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
