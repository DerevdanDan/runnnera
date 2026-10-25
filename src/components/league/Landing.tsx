import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { claimPlayer, linkGoogleAccount } from "@/lib/league.functions";

type Unclaimed = { id: string; name: string };
type Step =
  | { kind: "checking" }
  | { kind: "signed_out" }
  | { kind: "pick"; email: string | null; unclaimed: Unclaimed[] };

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** OAuth errors come back in the URL (query or hash) after the Google redirect. */
function oauthErrorFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search + "&" + window.location.hash.replace(/^#/, ""));
  return params.get("error_description") ?? params.get("error");
}

export function Landing() {
  const link = useServerFn(linkGoogleAccount);
  const claim = useServerFn(claimPlayer);
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>({ kind: "checking" });
  const [picked, setPicked] = useState<Unclaimed | null>(null);
  const [busy, setBusy] = useState(false);

  // Back from Google (or still signed in to Google from before): link the account to a name.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const error = oauthErrorFromUrl();
      if (error) toast.error(`Google sign-in failed: ${error}`);
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        setStep({ kind: "signed_out" });
        return;
      }
      try {
        const res = await link();
        if (cancelled) return;
        if (res.status === "signed_in") await qc.invalidateQueries({ queryKey: ["dashboard"] });
        else setStep({ kind: "pick", email: data.session.user.email ?? null, unclaimed: res.unclaimed });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't sign in");
        setStep({ kind: "signed_out" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [link, qc]);

  const signInWithGoogle = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) {
      toast.error(error.message);
      setBusy(false);
    }
  };

  const useAnotherAccount = async () => {
    await supabase.auth.signOut();
    setPicked(null);
    setStep({ kind: "signed_out" });
  };

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
        {step.kind === "checking" && <p className="text-sm text-muted-foreground">Checking sign-in…</p>}

        {step.kind === "signed_out" && (
          <Button
            onClick={signInWithGoogle}
            disabled={busy}
            className="h-14 gap-3 bg-white px-6 text-base font-semibold text-neutral-900 hover:bg-neutral-100"
          >
            <GoogleLogo />
            {busy ? "Opening Google…" : "Sign in with Google"}
          </Button>
        )}

        {step.kind === "pick" && (
          <div>
            <p className="text-sm font-semibold">Which one are you?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {step.email ? `Signed in as ${step.email}. ` : ""}Pick your name once and you'll stay signed in.
            </p>
            {step.unclaimed.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                There's no free name for you yet. Ask the admin to add you, then open the link again.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {step.unclaimed.map((p) => (
                  <Button
                    key={p.id}
                    variant={picked?.id === p.id ? "default" : "secondary"}
                    className="h-16 font-display text-2xl tracking-wide"
                    onClick={() => setPicked(p)}
                  >
                    {p.name}
                  </Button>
                ))}
              </div>
            )}
            {picked && (
              <Button
                disabled={busy}
                className="mt-5 h-14 bg-gradient-primary px-8 text-base font-semibold shadow-glow"
                onClick={async () => {
                  setBusy(true);
                  try {
                    await claim({ data: { playerId: picked.id } });
                    await qc.invalidateQueries({ queryKey: ["dashboard"] });
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Couldn't pick that name");
                    setBusy(false);
                  }
                }}
              >
                {busy ? "…" : `Yes, I'm ${picked.name}`}
              </Button>
            )}
            <button
              className="mt-6 block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              onClick={useAnotherAccount}
            >
              Use a different Google account
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
