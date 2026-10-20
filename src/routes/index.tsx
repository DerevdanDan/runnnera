import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ClaimName } from "@/components/league/ClaimName";
import { Landing } from "@/components/league/Landing";
import { LastMonth } from "@/components/league/LastMonth";
import { Leaderboard } from "@/components/league/Leaderboard";
import { Punishments } from "@/components/league/Punishments";
import { daysLeftInMonth, formatMonth } from "@/lib/league";
import { getDashboard, signOut } from "@/lib/league.functions";

const dashboardQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: () => getDashboard(),
});

export const Route = createFileRoute("/")({
  validateSearch: z.object({ error: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Last Place Spins — monthly Strava running league" },
      {
        name: "description",
        content:
          "Alvaro, Daniil and Mario race their monthly Strava kilometres. Last place spins the punishment wheel.",
      },
      { property: "og:title", content: "Last Place Spins — monthly Strava running league" },
      {
        property: "og:description",
        content: "Every run on Strava counts. Fewest kilometres at month end spins the punishment wheel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  component: Index,
});

function Index() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const { error } = Route.useSearch();

  if (data.state === "signed_out") return <Landing stravaConfigured={data.stravaConfigured} error={error} />;
  if (data.state === "needs_claim")
    return <ClaimName athleteName={data.athleteName} openSlots={data.openSlots} />;

  return <DashboardView data={data} />;
}

function DashboardView({ data }: { data: Extract<Awaited<ReturnType<typeof getDashboard>>, { state: "ready" }> }) {
  const logout = useServerFn(signOut);
  const qc = useQueryClient();
  const daysLeft = daysLeftInMonth(new Date());

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 md:py-12">
      <header className="flex items-center justify-between gap-4">
        <p className="font-display text-2xl tracking-[0.2em] text-primary">Last Place Spins</p>
        <div className="flex items-center gap-3">
          {data.me.avatarUrl && (
            <img src={data.me.avatarUrl} alt="" className="h-9 w-9 rounded-full border border-border object-cover" />
          )}
          <span className="text-sm font-semibold">{data.me.name}</span>
          <button
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={async () => {
              await logout();
              await qc.invalidateQueries({ queryKey: ["dashboard"] });
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {data.lastMonth && (
        <div className="mt-8">
          <LastMonth result={data.lastMonth} meId={data.me.playerId} />
        </div>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <div className="flex items-end justify-between gap-4">
            <h1 className="font-display text-6xl leading-none md:text-7xl">{formatMonth(data.month)}</h1>
            <p className="pb-1 text-right text-sm text-muted-foreground">
              <span className="font-display text-3xl text-foreground">{daysLeft}</span> days left
            </p>
          </div>
          <p className="mb-5 mt-2 text-sm text-muted-foreground">
            Runs, trail runs and treadmill runs from Strava. Refreshes every 10 minutes.
          </p>
          {data.syncError && <p className="mb-4 text-sm text-destructive">{data.syncError}</p>}
          <Leaderboard standings={data.standings} meId={data.me.playerId} />
        </section>
        <Punishments month={data.month} mine={data.myPunishments} counts={data.punishmentCounts} />
      </div>
    </main>
  );
}
