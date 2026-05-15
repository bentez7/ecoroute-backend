-- Migration 013: Per-user trip aggregates as a single SQL call.
-- PostgREST aggregate functions are disabled by default on hosted Supabase
-- for RLS-safety reasons, so we expose the aggregation via an RPC instead.
-- Postgres sums across hundreds of rows in microseconds and we ship four
-- numbers over the wire instead of every row.
--
-- Optional p_since lets the client restrict to a date window
-- (e.g. start of the current month) without changing the function shape.

CREATE OR REPLACE FUNCTION public.get_user_trip_stats(
  p_user_id uuid,
  p_since   timestamptz DEFAULT NULL
)
RETURNS TABLE (
  total_trips        bigint,
  total_distance_km  float8,
  total_duration_sec bigint,
  total_co2_kg       float8
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    COUNT(*)::bigint                            AS total_trips,
    COALESCE(SUM(distance_km),  0)::float8      AS total_distance_km,
    COALESCE(SUM(duration_sec), 0)::bigint      AS total_duration_sec,
    COALESCE(SUM(co2_kg),       0)::float8      AS total_co2_kg
  FROM public.trips
  WHERE user_id = p_user_id
    AND status  = 'ended'
    AND (p_since IS NULL OR started_at >= p_since);
$$;
