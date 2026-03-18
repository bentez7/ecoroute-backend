-- ============================================================
-- Carbon Aware Route Planner — Initial Schema
-- ============================================================

-- Extensions
create extension if not exists "moddatetime" schema extensions;

-- ============================================================
-- TABLE: public.users
-- Extends auth.users — one row per registered user
-- ============================================================
create table public.users (
  id             uuid        primary key references auth.users(id) on delete cascade,
  email          text,
  display_name   text,
  avatar_url     text,
  role           text        not null default 'user' check (role in ('user', 'admin')),
  account_status text        not null default 'active' check (account_status in ('active', 'suspended', 'deleted')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- updated_at trigger for users
create trigger handle_updated_at_users
  before update on public.users
  for each row execute procedure extensions.moddatetime(updated_at);

-- ============================================================
-- TABLE: public.vehicles
-- One user → many vehicles; FASTSim parameters stored here
-- ============================================================
create table public.vehicles (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references public.users(id) on delete cascade,
  label            text,
  vehicle_type     text        not null check (vehicle_type in ('petrol', 'diesel', 'lpg', 'ev', 'hybrid')),
  vehicle_mass_kg  float8,
  drag_coefficient float8,
  drivetrain_type  text        check (drivetrain_type in ('fwd', 'rwd', 'awd')),
  is_default       boolean     not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- updated_at trigger for vehicles
create trigger handle_updated_at_vehicles
  before update on public.vehicles
  for each row execute procedure extensions.moddatetime(updated_at);

-- ============================================================
-- TABLE: public.trips
-- One row per completed trip
-- ============================================================
create table public.trips (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references public.users(id) on delete cascade,
  vehicle_id            uuid        references public.vehicles(id) on delete set null,
  started_at            timestamptz not null,
  ended_at              timestamptz not null,
  distance_km           float8      not null,
  duration_sec          int         not null,
  route_polyline        text,
  origin_lat            float8      not null,
  origin_lng            float8      not null,
  origin_address        text,
  dest_lat              float8      not null,
  dest_lng              float8      not null,
  dest_address          text,
  fuel_type             text,
  energy_kwh            float8,
  co2_kg                float8,
  excess_vs_optimal_pct float8,
  driver_profile        text        check (driver_profile in ('smooth', 'normal', 'aggressive')),
  created_at            timestamptz not null default now()
);

-- ============================================================
-- TABLE: public.raw_telemetry
-- 0.5 Hz GPS + motion stream — staging table, pruned after 30d
-- ============================================================
create table public.raw_telemetry (
  id          bigserial   primary key,
  trip_id     uuid        not null references public.trips(id) on delete cascade,
  recorded_at timestamptz not null,
  lat         float8      not null,
  lng         float8      not null,
  speed_ms    float8,
  accel_ms2   float8,
  altitude_m  float8,
  heading_deg float8
);

-- ============================================================
-- TABLE: public.telemetry_segments
-- ML output — 60-second behavioural windows (permanent)
-- ============================================================
create table public.telemetry_segments (
  id                       uuid        primary key default gen_random_uuid(),
  trip_id                  uuid        not null references public.trips(id) on delete cascade,
  segment_index            int         not null,
  started_at               timestamptz not null,
  ended_at                 timestamptz not null,
  avg_speed_kmh            float8,
  speed_variance           float8,
  accel_variance           float8,
  braking_frequency        float8,
  idle_time_pct            float8,
  energy_kwh               float8,
  xgboost_efficiency_label text        check (xgboost_efficiency_label in ('optimal', 'suboptimal')),
  shap_top_feature         text,
  created_at               timestamptz not null default now()
);

-- ============================================================
-- TABLE: public.route_comparisons
-- Post-trip FASTSim route analysis — written by ML repo
-- ============================================================
create table public.route_comparisons (
  id                   uuid        primary key default gen_random_uuid(),
  trip_id              uuid        not null references public.trips(id) on delete cascade,
  route_label          text        not null check (route_label in ('taken', 'alt_1', 'alt_2')),
  distance_km          float8,
  estimated_energy_kwh float8,
  estimated_co2_kg     float8,
  elevation_gain_m     float8,
  route_polyline       text,
  created_at           timestamptz not null default now()
);

-- ============================================================
-- TABLE: public.feedback_events
-- Nudge log — auto-generated by backend on ML segment writeback
-- ============================================================
create table public.feedback_events (
  id           uuid        primary key default gen_random_uuid(),
  trip_id      uuid        not null references public.trips(id) on delete cascade,
  segment_id   uuid        references public.telemetry_segments(id) on delete set null,
  event_type   text        not null check (event_type in ('harsh_accel', 'harsh_brake', 'idling', 'speed_variance')),
  message      text,
  triggered_at timestamptz not null default now(),
  acknowledged boolean     not null default false
);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_trips_user_id               on public.trips(user_id);
create index idx_trips_started_at            on public.trips(started_at desc);
create index idx_trips_vehicle_id            on public.trips(vehicle_id);
create index idx_vehicles_user_id            on public.vehicles(user_id);
create index idx_telemetry_segments_trip_id  on public.telemetry_segments(trip_id);
create index idx_raw_telemetry_trip_id       on public.raw_telemetry(trip_id);
create index idx_raw_telemetry_recorded_at   on public.raw_telemetry(recorded_at);
create index idx_feedback_events_trip_id     on public.feedback_events(trip_id);

-- ============================================================
-- AUTH TRIGGER — auto-create public.users on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, display_name, role, account_status)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'display_name',
    'user',
    'active'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- users
alter table public.users enable row level security;

create policy "users_select_own" on public.users
  for select using (auth.uid() = id);

create policy "users_update_own" on public.users
  for update using (auth.uid() = id);

-- vehicles
alter table public.vehicles enable row level security;

create policy "vehicles_select_own" on public.vehicles
  for select using (auth.uid() = user_id);

create policy "vehicles_insert_own" on public.vehicles
  for insert with check (auth.uid() = user_id);

create policy "vehicles_update_own" on public.vehicles
  for update using (auth.uid() = user_id);

create policy "vehicles_delete_own" on public.vehicles
  for delete using (auth.uid() = user_id);

-- trips
alter table public.trips enable row level security;

create policy "trips_select_own" on public.trips
  for select using (auth.uid() = user_id);

create policy "trips_insert_own" on public.trips
  for insert with check (auth.uid() = user_id);

create policy "trips_update_own" on public.trips
  for update using (auth.uid() = user_id);

-- raw_telemetry
alter table public.raw_telemetry enable row level security;

create policy "raw_telemetry_select_own" on public.raw_telemetry
  for select using (
    trip_id in (select id from public.trips where user_id = auth.uid())
  );

create policy "raw_telemetry_insert_own" on public.raw_telemetry
  for insert with check (
    trip_id in (select id from public.trips where user_id = auth.uid())
  );

-- telemetry_segments
alter table public.telemetry_segments enable row level security;

create policy "telemetry_segments_select_own" on public.telemetry_segments
  for select using (
    trip_id in (select id from public.trips where user_id = auth.uid())
  );

-- route_comparisons
alter table public.route_comparisons enable row level security;

create policy "route_comparisons_select_own" on public.route_comparisons
  for select using (
    trip_id in (select id from public.trips where user_id = auth.uid())
  );

-- feedback_events
alter table public.feedback_events enable row level security;

create policy "feedback_events_select_own" on public.feedback_events
  for select using (
    trip_id in (select id from public.trips where user_id = auth.uid())
  );

create policy "feedback_events_update_own" on public.feedback_events
  for update using (
    trip_id in (select id from public.trips where user_id = auth.uid())
  );
