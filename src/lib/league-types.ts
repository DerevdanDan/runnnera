export type StandingRow = {
  playerId: string;
  name: string;
  avatarUrl: string | null;
  connected: boolean;
  meters: number;
  runs: number;
  syncedAt: string | null;
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

export type Dashboard =
  | { state: "signed_out"; stravaConfigured: boolean }
  | {
      state: "needs_claim";
      athleteName: string;
      avatarUrl: string | null;
      openSlots: { id: string; name: string }[];
    }
  | {
      state: "ready";
      me: { playerId: string; name: string; avatarUrl: string | null };
      month: string;
      standings: StandingRow[];
      myPunishments: { id: string; text: string }[];
      punishmentCounts: { name: string; count: number }[];
      lastMonth: LastMonthResult | null;
      syncError: string | null;
    };
