import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Landing } from "@/components/league/Landing";
import { LastMonth } from "@/components/league/LastMonth";
import { Leaderboard } from "@/components/league/Leaderboard";
import { MonthWheel } from "@/components/league/MonthWheel";
import { Punishments } from "@/components/league/Punishments";
import { AddPlayer } from "@/components/league/AddPlayer";
import { RunFeed } from "@/components/league/RunFeed";
import { ShareButton } from "@/components/league/ShareButton";
import { daysLeftInMonth, formatMonth } from "@/lib/league";
import type { PunishmentRow, StandingRow } from "@/lib/league-types";
import { dashboardQuery } from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Last Place Spins — monthly running league" },
      {
        name: "description",
        content:
          "A monthly running league between friends. Last place spins the punishment wheel.",
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

/** Month heading, days left, share button and the leaderboard. */
function MonthStandings({
  month,
  standings,
  punishments,
  meId,
}: {
  month: string;
  standings: StandingRow[];
  punishments: PunishmentRow[];
  meId: string | null;
}) {
  const daysLeft = daysLeftInMonth(new Date());
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-6xl leading-none md:text-7xl">{formatMonth(month)}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-display text-2xl text-foreground">{daysLeft}</span> {daysLeft === 1 ? "day" : "days"} left
            · fewest km at the end spins
          </p>
        </div>
        <ShareButton month={month} standings={standings} punishmentCount={punishments.length} />
      </div>
      <div className="mt-5">
        <Leaderboard standings={standings} meId={meId} />
      </div>
    </section>
  );
}

function Index() {
  const { data } = useSuspenseQuery(dashboardQuery);
  if (data.state === "signed_out")
    return (
      <>
        <Landing />
        <main className="mx-auto max-w-6xl px-5 pb-16">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <MonthStandings month={data.month} standings={data.standings} punishments={data.punishments} meId={null} />
            <MonthWheel month={data.month} standings={data.standings} punishments={data.punishments} meId={null} />
          </div>
          <div className="mt-12">
            <RunFeed feed={data.feed} canLog={false} />
          </div>
        </main>
      </>
    );

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 md:py-10">
      {data.lastMonth && (
        <div className="mb-10">
          <LastMonth result={data.lastMonth} meId={data.me.playerId} />
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <MonthStandings
          month={data.month}
          standings={data.standings}
          punishments={data.punishments}
          meId={data.me.playerId}
        />
        <MonthWheel month={data.month} standings={data.standings} punishments={data.punishments} meId={data.me.playerId}>
          <Punishments
            month={data.month}
            mineCount={data.punishments.filter((p) => p.playerId === data.me.playerId).length}
          />
        </MonthWheel>
      </div>

      <div className="mt-12">
        <RunFeed feed={data.feed} />
      </div>

      {data.people && (
        <div className="mt-12">
          <AddPlayer people={data.people} meId={data.me.playerId} month={data.month} />
        </div>
      )}
    </main>
  );
}
