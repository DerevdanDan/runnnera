ALTER TABLE public.players ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
UPDATE public.players SET is_admin = true WHERE name = 'Daniil';
CREATE UNIQUE INDEX IF NOT EXISTS players_name_lower_idx ON public.players (lower(name));