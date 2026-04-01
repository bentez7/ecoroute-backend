-- Migration 005: Add trip status column and relax nullable constraints
-- Trips now start as 'active' and are ended explicitly via PATCH /api/trips/:id/end

ALTER TABLE public.trips
  ADD COLUMN status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'ended', 'cancelled'));

-- These fields are only known when a trip ends, so they can be null for active trips
ALTER TABLE public.trips ALTER COLUMN ended_at     DROP NOT NULL;
ALTER TABLE public.trips ALTER COLUMN distance_km  DROP NOT NULL;
ALTER TABLE public.trips ALTER COLUMN duration_sec DROP NOT NULL;

CREATE INDEX idx_trips_status ON public.trips(status);
