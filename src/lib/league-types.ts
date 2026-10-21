export type StandingRow = {
  playerId: string;
  name: string;
  meters: number;
  runs: number;
};

export type WheelSlice = { id: string; text: string; author: string };

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
  | { state: "signed_out"; players: { id: string; name: string; hasPin: boolean }[] }
  | {
      state: "ready";
      me: { playerId: string; name: string };
      month: string;
      standings: StandingRow[];
      myPunishments: { id: string; text: string }[];
      punishmentCounts: { name: string; count: number }[];
      lastMonth: LastMonthResult | null;
      feed: FeedRun[];
    };
