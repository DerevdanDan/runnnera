export type StandingRow = {
  playerId: string;
  name: string;
  meters: number;
  runs: number;
  /** False for newcomers in their first (partial) month: they can't come last yet. */
  counts: boolean;
  countsFrom: string;
};

export type WheelSlice = { id: string; text: string; author: string; canDelete: boolean };

export type PunishmentRow = { id: string; text: string; playerId: string; author: string; canDelete: boolean };

/** What the admin sees about each person: which names have been claimed, and by which Google account. */
export type Person = {
  id: string;
  name: string;
  email: string | null;
  claimed: boolean;
  isAdmin: boolean;
  /** Only this Google account may claim the name. */
  inviteEmail: string | null;
  countsFrom: string;
};

/** Photo or video showing the loser did their punishment (a signed URL). */
export type Proof = { url: string; type: "image" | "video" } | null;

export type LastMonthResult = {
  month: string;
  standings: StandingRow[];
  loser: { playerId: string; name: string } | null;
  wheel: WheelSlice[];
  spin: { punishmentId: string; text: string; author: string; spunAt: string; proof: Proof } | null;
  canSpin: boolean;
  /** The loser (or the admin) can upload proof once the wheel has been spun. */
  canAddProof: boolean;
};

export type HistoryMonth = {
  month: string;
  loser: { playerId: string; name: string } | null;
  loserKm: number;
  punishment: { text: string; author: string } | null;
  spunAt: string | null;
  proof: Proof;
  canAddProof: boolean;
};

export type StatsRow = {
  playerId: string;
  name: string;
  /** False for newcomers still in their first month. */
  counts: boolean;
  monthKm: number;
  avgKmPerDay: number;
  monthRuns: number;
  longestKm: number;
  totalKm: number;
  totalRuns: number;
  weekStreak: number;
  weeklyKm: number[];
};

export type StatsPage = {
  month: string;
  daysSoFar: number;
  rows: StatsRow[];
  /** Monday of each week in `weeklyKm`, oldest first (YYYY-MM-DD). */
  weekStarts: string[];
  groupMonthKm: number;
  groupAvgKmPerDay: number;
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
  /** Owner while editable, or the admin at any time. */
  canDelete: boolean;
};

export type Dashboard =
  | {
      state: "signed_out";
      month: string;
      standings: StandingRow[];
      /** This month's wheel, visible to everyone. */
      punishments: PunishmentRow[];
      feed: FeedRun[];
    }
  | {
      state: "ready";
      me: { playerId: string; name: string; isAdmin: boolean };
      month: string;
      standings: StandingRow[];
      /** This month's wheel, visible to everyone. */
      punishments: PunishmentRow[];
      /** Admin only. */
      people: Person[] | null;
      lastMonth: LastMonthResult | null;
      feed: FeedRun[];
    };
