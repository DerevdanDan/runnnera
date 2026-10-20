import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PLAYER_NAMES } from "@/lib/league";

const ERRORS: Record<string, string> = {
  strava_denied: "Strava access was cancelled. Approve access to your activities to join.",
  strava_scope: "Please tick “View data about your activities” on the Strava screen so your runs can be counted.",
  strava_state: "That sign-in link expired. Please try again.",
  strava_failed: "Something went wrong talking to Strava. Please try again.",
  strava_not_configured: "Strava isn't connected to this app yet.",
};

export function Landing({ stravaConfigured, error }: { stravaConfigured: boolean; error?: string | undefined }) {
  const [inFrame, setInFrame] = useState(false);
  useEffect(() => {
    try {
      setInFrame(window.self !== window.top);
    } catch {
      setInFrame(true);
    }
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <p className="font-display text-xl tracking-[0.3em] text-primary">Monthly running league</p>
      <h1 className="mt-3 font-display text-[clamp(4rem,14vw,10rem)] leading-[0.85] text-foreground">
        Last place
        <br />
        <span className="bg-gradient-primary bg-clip-text text-transparent">spins.</span>
      </h1>
      <p className="mt-8 max-w-xl text-lg text-muted-foreground">
        {PLAYER_NAMES.join(", ")}. Every run on Strava counts. Whoever logs the fewest kilometres by the end
        of the month spins the wheel — loaded with punishments you all wrote on day one.
      </p>

      <div className="mt-10 flex flex-col items-start gap-4">
        {error && ERRORS[error] && (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-foreground">
            {ERRORS[error]}
          </p>
        )}
        {!stravaConfigured ? (
          <p className="rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            Waiting for the Strava app keys to be added — sign-in will appear here once they're in.
          </p>
        ) : inFrame ? (
          <div className="flex flex-col gap-2">
            <Button asChild size="lg" className="h-14 bg-gradient-primary px-8 text-base font-semibold shadow-glow">
              <a href="/" target="_blank" rel="noreferrer">
                Open the app in a new tab to connect Strava
              </a>
            </Button>
            <p className="text-sm text-muted-foreground">Strava sign-in doesn't work inside this preview window.</p>
          </div>
        ) : (
          <Button asChild size="lg" className="h-14 bg-gradient-primary px-8 text-base font-semibold shadow-glow">
            <a href="/api/public/strava/login">Connect with Strava</a>
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          We only read your activities to total your running distance.
        </p>
      </div>
    </main>
  );
}
