-- Newcomer rule: a player only counts toward "last place" from this month on (YYYY-MM).
ALTER TABLE public.players ADD COLUMN counts_from text CHECK (counts_from ~ '^\d{4}-\d{2}$');
UPDATE public.players SET counts_from = to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM');
ALTER TABLE public.players ALTER COLUMN counts_from SET NOT NULL;

-- Lock a name to one Google account: only this (normalized) email may claim it.
ALTER TABLE public.players ADD COLUMN invite_email text;

-- Duplicate screenshot check: SHA-256 of the original screenshot file.
ALTER TABLE public.runs ADD COLUMN photo_hash text;
CREATE INDEX runs_photo_hash_idx ON public.runs (photo_hash);

-- Proof that the loser did the punishment (photo or video in the run-photos bucket).
ALTER TABLE public.spins
  ADD COLUMN proof_path text,
  ADD COLUMN proof_type text CHECK (proof_type IS NULL OR proof_type IN ('image', 'video')),
  ADD COLUMN proof_at timestamptz;

COMMENT ON COLUMN public.players.counts_from IS 'First month (YYYY-MM) this player can come last; newcomers start next month';
COMMENT ON COLUMN public.players.invite_email IS 'If set, only the Google account with this normalized email can claim the name';
