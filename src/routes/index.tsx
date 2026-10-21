import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Landing } from "@/components/league/Landing";
import { LastMonth } from "@/components/league/LastMonth";
import { Leaderboard } from "@/components/league/Leaderboard";
import { Punishments } from "@/components/league/Punishments";
import { RunFeed } from "@/components/league/RunFeed";
import { daysLeftInMonth, formatMonth } from "@/lib/league";
import { getDashboard, signOut } from "@/lib/league.functions";

const dashboardQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: () => getDashboard(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Last Place Spins — monthly running league" },
      {
        name: "description",
        content:
          "Alvaro, Daniil and Mario log their runs every month. Last place spins the punishment wheel.",
      },
      { property: "og:title", content: "Last Place Spins — monthly running league" },
      {
        property: "og:description",
        content: "Log every run with a screenshot. Fewest kilometres at month end spins the punishment wheel.",
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
  if (data.state === "signed_out") return <Landing players={data.players} />;

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
            Runs logged this month by everyone.
          </p>
          <Leaderboard standings={data.standings} meId={data.me.playerId} />
        </section>
        <Punishments month={data.month} mine={data.myPunishments} counts={data.punishmentCounts} />
      </div>

      <div className="mt-12">
        <RunFeed feed={data.feed} />
      </div>
    </main>
  );
}
