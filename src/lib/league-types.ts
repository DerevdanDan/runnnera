export type StandingRow = {
  playerId: string;
  name: string;
  meters: number;
  runs: number;
};

export type WheelSlice = { id: string; text: string; author: string };

export type PunishmentRow = { id: string; text: string; playerId: string; author: string };

/** What the admin sees about each person: which names have been claimed, and by which Google account. */
export type Person = { id: string; name: string; email: string | null; claimed: boolean; isAdmin: boolean };

export type LastMonthResult = {
  month: string;
  standings: StandingRow[];
  loser: { playerId: string; name: string } | null;
  wheel: WheelSlice[];
  spin: { punishmentId: string; text: string; author: string; spunAt: string } | null;
  canSpin: boolean;
};

export type FeedRun = {
  id: string;
  playerId: string;
  name: string;
  runDate: string;
  meters: number;
  durationSeconds: number | null;
  note: string | null;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
};

export type Dashboard =
  | {
      state: "signed_out";
      month: string;
      standings: StandingRow[];
      feed: FeedRun[];
    }
  | {
      state: "ready";
      me: { playerId: string; name: string; isAdmin: boolean };
      month: string;
      standings: StandingRow[];
      /** Everyone's punishments for the current month (visible to all signed-in players). */
      punishments: PunishmentRow[];
      /** Admin only. */
      people: Person[] | null;
      lastMonth: LastMonthResult | null;
      feed: FeedRun[];
    };
