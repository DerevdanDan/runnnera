import { describe, expect, it } from "vitest";
import {
  canAddPunishment,
  findLoser,
  previousMonthKey,
} from "./league";

describe("league rules", () => {
  it("the player with the least km must spin", () => {
    const loser = findLoser([
      { playerId: "a", name: "Alvaro", meters: 52_000, runs: 6 },
      { playerId: "d", name: "Daniil", meters: 31_500, runs: 4 },
      { playerId: "m", name: "Mario", meters: 40_000, runs: 5 },
    ]);
    expect(loser?.name).toBe("Daniil");
  });

  it("a km tie is broken by fewer runs", () => {
    const loser = findLoser([
      { playerId: "a", name: "Alvaro", meters: 30_000, runs: 5 },
      { playerId: "m", name: "Mario", meters: 30_000, runs: 3 },
    ]);
    expect(loser?.name).toBe("Mario");
  });

  it("each player can add at most 3 punishments per month", () => {
    expect(canAddPunishment(2)).toBe(true);
    expect(canAddPunishment(3)).toBe(false);
  });

  it("previous month wraps across the year", () => {
    expect(previousMonthKey("2026-01")).toBe("2025-12");
  });
});

import { canEditRun, isValidRunDate, totalsForMonth } from "./league";

describe("manual runs", () => {
  it("sums only runs in the given month per player", () => {
    const t = totalsForMonth(
      [
        { player_id: "a", run_date: "2026-10-01", meters: 5000 },
        { player_id: "a", run_date: "2026-10-31", meters: 3000 },
        { player_id: "a", run_date: "2026-09-30", meters: 9000 },
      ],
      "2026-10",
    );
    expect(t.get("a")).toEqual({ meters: 8000, runs: 2 });
  });
  it("only the owner can edit, and not after the wheel is spun", () => {
    expect(canEditRun({ isOwner: true, monthSpun: false })).toBe(true);
    expect(canEditRun({ isOwner: false, monthSpun: false })).toBe(false);
    expect(canEditRun({ isOwner: true, monthSpun: true })).toBe(false);
  });
  it("rejects future run dates", () => {
    const now = new Date("2026-10-21T12:00:00Z");
    expect(isValidRunDate("2026-10-21", now)).toBe(true);
    expect(isValidRunDate("2026-10-25", now)).toBe(false);
  });
});
