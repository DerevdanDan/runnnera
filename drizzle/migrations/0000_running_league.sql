CREATE TABLE public.strava_accounts (
  athlete_id BIGINT PRIMARY KEY,
  firstname TEXT,
  lastname TEXT,
  avatar_url TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.strava_accounts TO service_role;
ALTER TABLE public.strava_accounts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  athlete_id BIGINT UNIQUE REFERENCES public.strava_accounts(athlete_id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

INSERT INTO public.players (name) VALUES ('Alvaro'), ('Daniil'), ('Mario');

CREATE TABLE public.monthly_distance (
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  meters DOUBLE PRECISION NOT NULL DEFAULT 0,
  run_count INTEGER NOT NULL DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, month)
);
GRANT ALL ON public.monthly_distance TO service_role;
ALTER TABLE public.monthly_distance ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.punishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 140),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX punishments_month_idx ON public.punishments (month);
GRANT ALL ON public.punishments TO service_role;
ALTER TABLE public.punishments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.spins (
  month TEXT PRIMARY KEY CHECK (month ~ '^\d{4}-\d{2}$'),
  loser_player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  punishment_id UUID NOT NULL REFERENCES public.punishments(id) ON DELETE CASCADE,
  spun_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.spins TO service_role;
ALTER TABLE public.spins ENABLE ROW LEVEL SECURITY;