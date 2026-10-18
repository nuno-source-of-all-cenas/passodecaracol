-- Passo: first migration. Postgres 15 + PostGIS on Supabase. RLS on every table.
create extension if not exists postgis;

create table athletes (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  sex text check (sex in ('f','m','x')),
  city text,
  avatar_url text,
  units text not null default 'metric' check (units in ('metric','imperial')),
  default_visibility text not null default 'everyone' check (default_visibility in ('everyone','followers','only_me')),
  plan text not null default 'free' check (plan in ('free','pro')),
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table follows (
  follower_id uuid not null references athletes(id) on delete cascade,
  followee_id uuid not null references athletes(id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index on follows (followee_id);

create table gear (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  kind text not null check (kind in ('shoe','bike')),
  name text not null,
  brand text,
  alert_at_m integer,
  retired boolean not null default false,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on gear (athlete_id);

create table activities (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  sport text not null check (sport in ('run','ride','walk','hike','swim','workout','trail_run')),
  name text not null,
  description text,
  start_at timestamptz not null,
  timezone text not null,
  distance_m integer not null default 0,
  moving_time_s integer not null default 0,
  elapsed_time_s integer not null default 0,
  elevation_gain_m integer not null default 0,
  avg_hr smallint, max_hr smallint,
  calories integer,
  relative_effort integer,
  perceived_exertion smallint check (perceived_exertion between 1 and 10),
  visibility text not null default 'everyone' check (visibility in ('everyone','followers','only_me')),
  hide_stats jsonb not null default '{}',
  gear_id uuid references gear(id) on delete set null,
  track geography(LineString, 4326),
  stream_path text,              -- storage object with lat,lon,ele,t,hr arrays
  source_hash text,              -- idempotent uploads
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (elapsed_time_s >= moving_time_s)
);
create index on activities (athlete_id, start_at desc);
create index on activities using gist (track);
create unique index on activities (athlete_id, source_hash) where source_hash is not null;

create table laps (
  activity_id uuid not null references activities(id) on delete cascade,
  idx smallint not null,
  start_index integer not null, end_index integer not null,
  distance_m integer not null, elapsed_time_s integer not null,
  primary key (activity_id, idx)
);

create table photos (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  path text not null, caption text,
  created_at timestamptz not null default now()
);
create index on photos (activity_id);

create table kudos (
  activity_id uuid not null references activities(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (activity_id, athlete_id)
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on comments (activity_id, created_at);

create table segments (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references athletes(id) on delete set null,
  name text not null,
  sport text not null check (sport in ('run','ride')),
  path geography(LineString, 4326) not null,
  distance_m integer not null,
  avg_grade numeric(4,1) not null,
  max_grade numeric(4,1) not null,
  elev_low_m integer not null, elev_high_m integer not null,
  climb_category smallint check (climb_category between 0 and 5),
  hazardous boolean not null default false,
  created_at timestamptz not null default now()
);
create index on segments using gist (path);

create table segment_efforts (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid not null references segments(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  start_index integer not null, end_index integer not null,
  elapsed_time_s integer not null check (elapsed_time_s > 0),
  start_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index on segment_efforts (segment_id, elapsed_time_s);
create index on segment_efforts (athlete_id, segment_id);
create index on segment_efforts (activity_id);

create table starred_segments (
  athlete_id uuid not null references athletes(id) on delete cascade,
  segment_id uuid not null references segments(id) on delete cascade,
  primary key (athlete_id, segment_id)
);

create table routes (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  name text not null,
  sport text not null,
  path geography(LineString, 4326) not null,
  distance_m integer not null,
  elevation_gain_m integer not null,
  visibility text not null default 'only_me' check (visibility in ('everyone','only_me')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on routes (athlete_id);

create table clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null, sport text not null, city text, description text,
  private boolean not null default false,
  created_at timestamptz not null default now()
);
create table club_members (
  club_id uuid not null references clubs(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  role text not null default 'member' check (role in ('member','admin')),
  joined_at timestamptz not null default now(),
  primary key (club_id, athlete_id)
);
create index on club_members (athlete_id);
create table club_posts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index on club_posts (club_id, created_at desc);
create table club_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  title text not null, start_at timestamptz not null,
  route_id uuid references routes(id) on delete set null,
  created_at timestamptz not null default now()
);
create table club_event_rsvps (
  event_id uuid not null references club_events(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  primary key (event_id, athlete_id)
);

create table challenges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sport text,
  metric text not null check (metric in ('distance','time','elevation','single_distance')),
  target numeric not null check (target > 0),
  starts_at timestamptz not null, ends_at timestamptz not null,
  check (ends_at > starts_at)
);
create table challenge_joins (
  challenge_id uuid not null references challenges(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  joined_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (challenge_id, athlete_id)
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  period text not null check (period in ('week','month','year')),
  sport text not null,
  metric text not null check (metric in ('distance','time','elevation')),
  target numeric not null check (target > 0),
  created_at timestamptz not null default now()
);
create index on goals (athlete_id);

create table privacy_zones (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  center geography(Point, 4326) not null,
  radius_m integer not null check (radius_m between 200 and 1600)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  kind text not null check (kind in ('kudos','comment','follow','pr','kom','challenge')),
  actor_id uuid references athletes(id) on delete cascade,
  ref_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications (athlete_id, created_at desc);

-- Visibility helper used by RLS.
create function can_view_activity(a activities) returns boolean
language sql stable security definer set search_path = public as $$
  select a.athlete_id = auth.uid()
      or a.visibility = 'everyone'
      or (a.visibility = 'followers' and exists (
            select 1 from follows f
            where f.follower_id = auth.uid() and f.followee_id = a.athlete_id and f.status = 'accepted'))
$$;

alter table activities enable row level security;
create policy "read visible" on activities for select using (can_view_activity(activities));
create policy "own write" on activities for all using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());

alter table kudos enable row level security;
create policy "read" on kudos for select using (exists (select 1 from activities a where a.id = activity_id and can_view_activity(a)));
create policy "give" on kudos for insert with check (athlete_id = auth.uid()
  and exists (select 1 from activities a where a.id = activity_id and can_view_activity(a) and a.athlete_id <> auth.uid()));
create policy "take back" on kudos for delete using (athlete_id = auth.uid());

alter table comments enable row level security;
create policy "read" on comments for select using (exists (select 1 from activities a where a.id = activity_id and can_view_activity(a)));
create policy "write" on comments for insert with check (athlete_id = auth.uid()
  and exists (select 1 from activities a where a.id = activity_id and can_view_activity(a)));
create policy "delete own" on comments for delete using (athlete_id = auth.uid());

-- Owner-only tables.
do $$ declare t text; begin
  foreach t in array array['gear','routes','goals','privacy_zones','notifications','starred_segments'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "owner" on %I for all using (athlete_id = auth.uid()) with check (athlete_id = auth.uid())', t);
  end loop;
end $$;

alter table athletes enable row level security;
create policy "public profiles" on athletes for select using (true);
create policy "self update" on athletes for update using (id = auth.uid());

alter table segments enable row level security;
create policy "read" on segments for select using (true);
create policy "create" on segments for insert with check (creator_id = auth.uid());

alter table segment_efforts enable row level security;
create policy "read visible" on segment_efforts for select using (exists (select 1 from activities a where a.id = activity_id and can_view_activity(a)));
-- efforts are written only by the analyze_activity job (service role).

-- v2: sessions (level 1), live sharing, race files, steps
create table sessions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  share_id text unique,              -- live link; null when not shared
  share_expires_at timestamptz,
  stream_path text,                  -- whole session stream in storage
  created_at timestamptz not null default now()
);
create index on sessions (athlete_id, start_at desc);
alter table activities add column session_id uuid references sessions(id) on delete set null;
alter table activities add column kind text not null default 'treino' check (kind in ('treino','prova'));
alter table activities add column race jsonb;  -- name, bib, official_s, pos, total, cat, pos_cat, url
create table activity_files (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  kind text not null check (kind in ('official_photo','certificate','clip')),
  path text not null, name text, km numeric(5,1),
  created_at timestamptz not null default now()
);
create index on activity_files (activity_id);
alter table gear add column type text, add column drop_mm smallint, add column weight_g smallint,
  add column purchased_on date, add column price_cents integer, add column notes text, add column photo_path text;
create table daily_steps (
  athlete_id uuid not null references athletes(id) on delete cascade,
  day date not null, steps integer not null check (steps >= 0),
  source text not null default 'health_connect',
  primary key (athlete_id, day)
);
alter table sessions enable row level security;
create policy "owner" on sessions for all using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
-- public live view goes through an edge function that checks share_id and expiry, never through RLS.
alter table activity_files enable row level security;
create policy "read visible" on activity_files for select using (exists (select 1 from activities a where a.id = activity_id and can_view_activity(a)));
create policy "owner write" on activity_files for all using (exists (select 1 from activities a where a.id = activity_id and a.athlete_id = auth.uid()));
alter table daily_steps enable row level security;
create policy "owner" on daily_steps for all using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
