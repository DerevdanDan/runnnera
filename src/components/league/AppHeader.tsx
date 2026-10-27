import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { signOut } from "@/lib/league.functions";
import { meQuery } from "@/lib/queries";

type InstallPrompt = Event & { prompt: () => Promise<void> };

/** "Install app": Chrome/Android offer a real prompt; on iPhone it's Share → Add to Home Screen. */
function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!prompt && !ios) return null;
  return (
    <button
      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      onClick={async () => {
        if (prompt) {
          await prompt.prompt();
          setPrompt(null);
        } else {
          toast("Add it to your Home Screen", {
            description: "Tap the Share button in Safari, then “Add to Home Screen”.",
            duration: 8000,
          });
        }
      }}
    >
      <Download className="h-3.5 w-3.5" />
      Install app
    </button>
  );
}

const NAV = [
  { to: "/", label: "Home" },
  { to: "/stats", label: "Stats" },
  { to: "/history", label: "Hall of shame" },
] as const;

export function AppHeader() {
  const { data: me } = useQuery(meQuery);
  const logout = useServerFn(signOut);
  const qc = useQueryClient();
  const navigate = useNavigate();

  return (
    <header className="z-40 border-b border-border/60 bg-background/75 backdrop-blur-md sm:sticky sm:top-0">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary font-display text-lg text-primary-foreground shadow-glow">
            R
          </span>
          <span className="font-display text-xl tracking-[0.08em] sm:text-2xl sm:tracking-[0.15em]">Runnnera</span>
        </Link>

        <nav className="order-last flex w-full gap-1 sm:order-none sm:w-auto">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
              activeOptions={{ exact: true }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <InstallButton />
          {me ? (
            <>
              <span className="text-sm font-semibold">
                {me.name}
                {me.isAdmin && <span className="ml-1.5 text-xs font-normal text-primary">admin</span>}
              </span>
              <button
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={async () => {
                  await logout();
                  // Also drop the Google session, or the home page would sign straight back in.
                  await supabase.auth.signOut();
                  await qc.invalidateQueries();
                  await navigate({ to: "/" });
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link to="/" className="text-sm font-semibold text-primary hover:underline">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
