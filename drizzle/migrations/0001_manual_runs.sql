ALTER TABLE public.players ADD COLUMN pin_hash text, ADD COLUMN pin_salt text;

CREATE TABLE public.runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  run_date date NOT NULL,
  meters double precision NOT NULL CHECK (meters > 0 AND meters <= 200000),
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  note text CHECK (note IS NULL OR char_length(note) <= 280),
  photo_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX runs_date_idx ON public.runs (run_date DESC);
GRANT ALL ON public.runs TO service_role;
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.monthly_distance IS 'DEPRECATED: km now come from manually logged runs';
COMMENT ON TABLE public.strava_accounts IS 'DEPRECATED: Strava sign-in replaced by name + PIN';
COMMENT ON COLUMN public.players.athlete_id IS 'DEPRECATED: replaced by pin_hash login';