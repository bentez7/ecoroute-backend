alter table public.telemetry_segments
  add column polyline  text,
  add column start_lat float8,
  add column start_lng float8,
  add column end_lat   float8,
  add column end_lng   float8;
