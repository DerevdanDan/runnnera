import { describe, expect, it } from "vitest";
import {
  canAddPunishment,
  findLoser,
  previousMonthKey,
  rankStandings,
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

  it("the leaderboard's bottom row is the player who must spin, even on ties", () => {
    const standings = [
      { playerId: "a", name: "Alvaro", meters: 0, runs: 0 },
      { playerId: "d", name: "Daniil", meters: 6_660, runs: 1 },
      { playerId: "e", name: "Eric", meters: 0, runs: 0 },
      { playerId: "r", name: "Rocco", meters: 0, runs: 0 },
    ];
    expect(rankStandings(standings).at(-1)?.name).toBe(findLoser(standings)?.name);
  });

  it("each player can add at most 3 punishments per month", () => {
    expect(canAddPunishment(2)).toBe(true);
    expect(canAddPunishment(3)).toBe(false);
  });

  it("previous month wraps across the year", () => {
    expect(previousMonthKey("2026-01")).toBe("2025-12");
  });
});

import { canDeletePunishment, canDeleteRun, canEditRun, isValidRunDate, totalsForMonth } from "./league";

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
    expect(canEditRun({ isOwner: false, monthSpun: true, isAdmin: true })).toBe(true);
  });
  it("the admin can delete any run, owners only while they can edit", () => {
    expect(canDeleteRun({ isOwner: false, isAdmin: true, monthSpun: true })).toBe(true);
    expect(canDeleteRun({ isOwner: true, isAdmin: false, monthSpun: false })).toBe(true);
    expect(canDeleteRun({ isOwner: true, isAdmin: false, monthSpun: true })).toBe(false);
    expect(canDeleteRun({ isOwner: false, isAdmin: false, monthSpun: false })).toBe(false);
  });
  it("the admin can delete anyone's punishment until that month is spun", () => {
    const base = { isOwner: false, isAdmin: true, isCurrentMonth: true, monthSpun: false };
    expect(canDeletePunishment(base)).toBe(true);
    expect(canDeletePunishment({ ...base, isCurrentMonth: false })).toBe(true);
    expect(canDeletePunishment({ ...base, monthSpun: true })).toBe(false);
    expect(canDeletePunishment({ ...base, isAdmin: false })).toBe(false);
    expect(canDeletePunishment({ ...base, isAdmin: false, isOwner: true })).toBe(true);
    expect(canDeletePunishment({ ...base, isAdmin: false, isOwner: true, isCurrentMonth: false })).toBe(false);
  });
  it("rejects future run dates", () => {
    const now = new Date("2026-10-21T12:00:00Z");
    expect(isValidRunDate("2026-10-21", now)).toBe(true);
    expect(isValidRunDate("2026-10-25", now)).toBe(false);
  });
});

import { computeStats, countsInMonth, findMonthLoser, isSameRun, nextMonthKey, normalizeEmail } from "./league";

describe("newcomers", () => {
  it("someone added mid-month only counts from next month", () => {
    expect(nextMonthKey("2026-12")).toBe("2027-01");
    expect(countsInMonth("2026-11", "2026-10")).toBe(false);
    expect(countsInMonth("2026-11", "2026-11")).toBe(true);
    expect(countsInMonth("2026-10", "2026-12")).toBe(true);
  });
  it("a newcomer on 0 km doesn't come last in their first month", () => {
    const loser = findMonthLoser([
      { playerId: "a", name: "Alvaro", meters: 2_000, runs: 1, counts: true },
      { playerId: "r", name: "Rocco", meters: 0, runs: 0, counts: false },
    ]);
    expect(loser?.name).toBe("Alvaro");
  });
});

describe("gmail locks", () => {
  it("matches Gmail addresses the way Google does", () => {
    expect(normalizeEmail(" Der.Ev.Dan+runs@GMAIL.com ")).toBe("derevdan@gmail.com");
    expect(normalizeEmail("derevdan@googlemail.com")).toBe("derevdan@gmail.com");
    expect(normalizeEmail("First.Last@Example.org")).toBe("first.last@example.org");
  });
});

describe("duplicate runs", () => {
  const run = { playerId: "d", runDate: "2026-10-23", meters: 6660, durationSeconds: 2460, photoHash: "abc" };
  it("flags the same screenshot or the same run logged twice", () => {
    expect(isSameRun(run, { ...run, playerId: "m" })).toBe(true); // someone else's identical screenshot
    expect(isSameRun(run, { ...run, playerId: "m", photoHash: "other" })).toBe(false); // ran together
    expect(isSameRun(run, { ...run, runDate: "2026-10-01", meters: 1000 })).toBe(true); // same file
    expect(isSameRun(run, { ...run, photoHash: "other", meters: 6680, durationSeconds: 2500 })).toBe(true);
    expect(isSameRun(run, { ...run, photoHash: "other", meters: 7000 })).toBe(false);
    expect(isSameRun(run, { ...run, photoHash: "other", runDate: "2026-10-24" })).toBe(false);
    expect(isSameRun(run, { ...run, photoHash: null, durationSeconds: null })).toBe(false);
  });
});

describe("stats", () => {
  const runs = [
    { player_id: "d", run_date: "2026-10-05", meters: 10_000 }, // Mon 5 Oct
    { player_id: "d", run_date: "2026-10-14", meters: 6_000 }, // week of 12 Oct
    { player_id: "d", run_date: "2026-10-20", meters: 4_000 }, // week of 19 Oct
    { player_id: "d", run_date: "2026-10-26", meters: 5_000 }, // this week (Mon 26 Oct)
    { player_id: "d", run_date: "2026-09-29", meters: 21_100 },
  ];
  it("works out month km, average per day, longest run and the weekly streak", () => {
    const [d] = computeStats(runs, ["d"], "2026-10-27");
    expect(d).toMatchObject({ monthKm: 25, monthRuns: 4, longestKm: 21.1, totalKm: 46.1, totalRuns: 5 });
    expect(d!.avgKmPerDay).toBeCloseTo(25 / 27, 2);
    expect(d!.weekStreak).toBe(5); // 28 Sep, 5 Oct, 12 Oct, 19 Oct, 26 Oct
    expect(d!.weeklyKm).toEqual([0, 21.1, 10, 6, 4, 5]);
  });
  it("keeps a streak alive while this week has no run yet", () => {
    // No run yet this week (26 Oct), but last week has one: the streak still counts back from there.
    const [d] = computeStats(runs.slice(0, 3), ["d"], "2026-10-27");
    expect(d!.weekStreak).toBe(3); // 19, 12 and 5 Oct
    // A whole week without a run breaks it.
    const [e] = computeStats(runs.slice(0, 2), ["d"], "2026-10-27");
    expect(e!.weekStreak).toBe(0);
  });
});
