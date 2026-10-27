import { Share2 } from "lucide-react";
import { daysLeftInMonth, findMonthLoser, formatMonth, metersToKm } from "@/lib/league";
import type { StandingRow } from "@/lib/league-types";

/** Standings as a chat message, e.g. for the WhatsApp group. */
export function shareText(month: string, standings: StandingRow[], punishmentCount: number, url: string): string {
  const racing = standings.filter((s) => s.counts);
  const newcomers = standings.filter((s) => !s.counts);
  const loser = findMonthLoser(standings);
  const lines = [
    `🏃 Last Place Spins · ${formatMonth(month)}`,
    "",
    ...racing.map(
      (s, i) => `${i + 1}. ${s.name} ${metersToKm(s.meters).toFixed(1)} km${s.playerId === loser?.playerId ? " 🎡" : ""}`,
    ),
  ];
  if (newcomers.length) lines.push(`New: ${newcomers.map((s) => s.name).join(", ")}`);
  const days = daysLeftInMonth(new Date());
  lines.push("", `${days} ${days === 1 ? "day" : "days"} left · ${punishmentCount} punishments on the wheel`, url);
  return lines.join("\n");
}

export function ShareButton({
  month,
  standings,
  punishmentCount,
}: {
  month: string;
  standings: StandingRow[];
  punishmentCount: number;
}) {
  return (
    <button
      className="flex items-center gap-1.5 rounded-full bg-[#25D366] px-3.5 py-1.5 text-sm font-semibold text-[#0b2a17] hover:brightness-110"
      onClick={async () => {
        const text = shareText(month, standings, punishmentCount, `${window.location.origin}/`);
        // Phones get the native share sheet (WhatsApp included); elsewhere open WhatsApp directly.
        if (navigator.share) {
          try {
            await navigator.share({ text });
            return;
          } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") return;
          }
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
      }}
    >
      <Share2 className="h-4 w-4" />
      Share
    </button>
  );
}
