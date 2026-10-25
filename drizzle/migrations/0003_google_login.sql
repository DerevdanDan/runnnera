ALTER TABLE public.players
  ADD COLUMN user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN email text;

COMMENT ON COLUMN public.players.user_id IS 'Google account (Supabase Auth user) that claimed this name';
COMMENT ON COLUMN public.players.email IS 'Email of that Google account, shown to the admin only';
COMMENT ON COLUMN public.players.pin_hash IS 'DEPRECATED: replaced by Google sign-in (user_id)';
COMMENT ON COLUMN public.players.pin_salt IS 'DEPRECATED: replaced by Google sign-in (user_id)';
