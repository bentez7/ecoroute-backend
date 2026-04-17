-- Migration 009: Add cumulative carbon footprint tracking to users
-- Stores a running total of CO2 emissions (kg) across all completed trips.

-- 1. Add column with default 0 so existing users start at zero
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS total_co2_kg float8 NOT NULL DEFAULT 0;

-- 2. Atomic increment function — avoids read-then-write race conditions.
--    Called from the backend via serviceClient.rpc('increment_user_co2', { ... })
CREATE OR REPLACE FUNCTION public.increment_user_co2(
  p_user_id uuid,
  p_amount  float8
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
     SET total_co2_kg = total_co2_kg + p_amount
   WHERE id = p_user_id;
END;
$$;
