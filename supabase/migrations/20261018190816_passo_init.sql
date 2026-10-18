-- Passo: everything lives in its own schema, nothing in public is touched.
create schema if not exists passo;

create table passo.athletes (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  sex text check (sex in ('f','m','x')),
  city text, bio text,
  units text not null default 'metric' check (units in ('metric','imperial')),
  default_visibility text not null default 'everyone' check (default_visibility in ('everyone','followers','only_me')),
  plan text not null default 'free' check (plan in ('free','pro')),
  step_goal integer not null default 10000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table passo.follows (
  follower_id uuid not null references passo.athletes(id) on delete cascade,
  followee_id uuid not null references passo.athletes(id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index on passo.follows (followee_id);

create table passo.gear (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references passo.athletes(id) on delete cascade,
  kind text not null check (kind in ('shoe','bike')),
  name text not null, brand text, type text,
  drop_mm smallint, weight_g smallint, purchased_on date, price_cents integer,
  base_m integer not null default 0, alert_m integer,
  retired boolean not null default false, default_for text, notes text, photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on passo.gear (athlete_id);

create table passo.sessions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references passo.athletes(id) on delete cascade,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  share_id text unique check (share_id ~ '^[a-z0-9]{6,24}$'),
  share_expires_at timestamptz,
  track jsonb,            -- [[lat,lon,ele,t,hr],...]
  ranges jsonb,           -- [{kind,label,i0,i1,activity_id}]
  created_at timestamptz not null default now()
);
create index on passo.sessions (athlete_id, start_at desc);

create table passo.activities (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references passo.athletes(id) on delete cascade,
  session_id uuid references passo.sessions(id) on delete set null,
  sport text not null check (sport in ('run','trail_run','ride','walk','hike','swim','workout')),
  kind text not null default 'treino' check (kind in ('treino','prova')),
  name text not null, description text,
  start_at timestamptz not null,
  distance_m integer not null default 0,
  moving_time_s integer not null default 0,
  elapsed_time_s integer not null default 0,
  elevation_gain_m integer not null default 0,
  avg_hr smallint, max_hr smallint, calories integer, relative_effort integer, steps integer,
  perceived_exertion smallint check (perceived_exertion between 1 and 10),
  visibility text not null default 'everyone' check (visibility in ('everyone','followers','only_me')),
  hide_stats jsonb not null default '{}',
  gear_id uuid references passo.gear(id) on delete set null,
  track jsonb, laps jsonb not null default '[]',
  race jsonb,             -- {name,bib,official,pos,total,cat,posCat,url}
  source_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (elapsed_time_s >= moving_time_s)
);
create index on passo.activities (athlete_id, start_at desc);
create index on passo.activities (session_id);
create index on passo.activities (gear_id);
create unique index on passo.activities (athlete_id, source_hash) where source_hash is not null;

create table passo.activity_files (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references passo.activities(id) on delete cascade,
  kind text not null check (kind in ('photo','official_photo','certificate','clip')),
  path text not null, name text, km numeric(5,1),
  created_at timestamptz not null default now()
);
create index on passo.activity_files (activity_id);

create table passo.kudos (
  activity_id uuid not null references passo.activities(id) on delete cascade,
  athlete_id uuid not null references passo.athletes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (activity_id, athlete_id)
);
create index on passo.kudos (athlete_id);

create table passo.comments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references passo.activities(id) on delete cascade,
  athlete_id uuid not null references passo.athletes(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on passo.comments (activity_id, created_at);
create index on passo.comments (athlete_id);

create table passo.segments (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references passo.athletes(id) on delete set null,
  name text not null,
  sport text not null check (sport in ('run','ride')),
  pts jsonb not null, distance_m integer not null,
  avg_grade numeric(4,1) not null, max_grade numeric(4,1) not null,
  created_at timestamptz not null default now()
);
create index on passo.segments (creator_id);

create table passo.segment_efforts (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid not null references passo.segments(id) on delete cascade,
  activity_id uuid not null references passo.activities(id) on delete cascade,
  athlete_id uuid not null references passo.athletes(id) on delete cascade,
  start_index integer not null, end_index integer not null,
  elapsed_time_s integer not null check (elapsed_time_s > 0),
  start_at timestamptz not null
);
create index on passo.segment_efforts (segment_id, elapsed_time_s);
create index on passo.segment_efforts (athlete_id, segment_id);
create index on passo.segment_efforts (activity_id);

create table passo.starred_segments (
  athlete_id uuid not null references passo.athletes(id) on delete cascade,
  segment_id uuid not null references passo.segments(id) on delete cascade,
  primary key (athlete_id, segment_id)
);
create index on passo.starred_segments (segment_id);

create table passo.routes (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references passo.athletes(id) on delete cascade,
  name text not null, sport text not null,
  pts jsonb not null, wps jsonb, snap boolean not null default true,
  distance_m integer not null default 0, elevation_gain_m integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on passo.routes (athlete_id);

create table passo.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null, sport text not null, city text, description text,
  created_by uuid references passo.athletes(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on passo.clubs (created_by);
create table passo.club_members (
  club_id uuid not null references passo.clubs(id) on delete cascade,
  athlete_id uuid not null references passo.athletes(id) on delete cascade,
  role text not null default 'member' check (role in ('member','admin')),
  joined_at timestamptz not null default now(),
  primary key (club_id, athlete_id)
);
create index on passo.club_members (athlete_id);
create table passo.club_posts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references passo.clubs(id) on delete cascade,
  athlete_id uuid not null references passo.athletes(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index on passo.club_posts (club_id, created_at desc);
create index on passo.club_posts (athlete_id);

create table passo.challenges (
  id uuid primary key default gen_random_uuid(),
  name text not null, sport text,
  metric text not null check (metric in ('distance','time','elevation','single_distance')),
  target numeric not null check (target > 0),
  starts_at timestamptz not null, ends_at timestamptz not null,
  check (ends_at > starts_at)
);
create table passo.challenge_joins (
  challenge_id uuid not null references passo.challenges(id) on delete cascade,
  athlete_id uuid not null references passo.athletes(id) on delete cascade,
  joined_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (challenge_id, athlete_id)
);
create index on passo.challenge_joins (athlete_id);

create table passo.goals (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references passo.athletes(id) on delete cascade,
  period text not null check (period in ('week','month','year')),
  sport text not null, metric text not null check (metric in ('distance','time','elevation')),
  target numeric not null check (target > 0),
  created_at timestamptz not null default now()
);
create index on passo.goals (athlete_id);

create table passo.daily_steps (
  athlete_id uuid not null references passo.athletes(id) on delete cascade,
  day date not null, steps integer not null check (steps >= 0),
  source text not null default 'health_connect',
  primary key (athlete_id, day)
);

create table passo.notifications (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references passo.athletes(id) on delete cascade,
  kind text not null check (kind in ('kudos','comment','follow','pr','kom','challenge')),
  actor_id uuid references passo.athletes(id) on delete cascade,
  ref_id uuid, read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on passo.notifications (athlete_id, created_at desc);
create index on passo.notifications (actor_id);

-- Live sharing: the runner writes, anyone with the share id reads through get_live().
create table passo.live (
  share_id text primary key check (share_id ~ '^[a-z0-9]{6,24}$'),
  athlete_id uuid not null references passo.athletes(id) on delete cascade,
  session_id uuid references passo.sessions(id) on delete cascade,
  snap jsonb not null default '{}',
  trail jsonb not null default '[]',
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 hours',
  ended boolean not null default false
);
create index on passo.live (athlete_id);

-- ---------- access rules ----------
create function passo.can_view_activity(a passo.activities) returns boolean
language sql stable security definer set search_path = '' as $$
  select a.athlete_id = (select auth.uid())
      or a.visibility = 'everyone'
      or (a.visibility = 'followers' and exists (
            select 1 from passo.follows f
            where f.follower_id = (select auth.uid()) and f.followee_id = a.athlete_id and f.status = 'accepted'))
$$;
revoke execute on function passo.can_view_activity(passo.activities) from public, anon;

alter table passo.athletes enable row level security;
create policy "athletes readable by signed-in" on passo.athletes for select to authenticated using (true);
create policy "athlete creates self" on passo.athletes for insert to authenticated with check (id = (select auth.uid()));
create policy "athlete updates self" on passo.athletes for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

alter table passo.follows enable row level security;
create policy "follows readable" on passo.follows for select to authenticated using (true);
create policy "follow as self" on passo.follows for insert to authenticated with check (follower_id = (select auth.uid()));
create policy "unfollow as self" on passo.follows for delete to authenticated using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));

alter table passo.activities enable row level security;
create policy "read visible activities" on passo.activities for select to authenticated using (passo.can_view_activity(activities));
create policy "own activities insert" on passo.activities for insert to authenticated with check (athlete_id = (select auth.uid()));
create policy "own activities update" on passo.activities for update to authenticated using (athlete_id = (select auth.uid())) with check (athlete_id = (select auth.uid()));
create policy "own activities delete" on passo.activities for delete to authenticated using (athlete_id = (select auth.uid()));

alter table passo.activity_files enable row level security;
create policy "read files of visible activities" on passo.activity_files for select to authenticated using (exists (select 1 from passo.activities a where a.id = activity_id and passo.can_view_activity(a)));
create policy "own files write" on passo.activity_files for all to authenticated using (exists (select 1 from passo.activities a where a.id = activity_id and a.athlete_id = (select auth.uid()))) with check (exists (select 1 from passo.activities a where a.id = activity_id and a.athlete_id = (select auth.uid())));

alter table passo.kudos enable row level security;
create policy "read kudos" on passo.kudos for select to authenticated using (exists (select 1 from passo.activities a where a.id = activity_id and passo.can_view_activity(a)));
create policy "give kudos" on passo.kudos for insert to authenticated with check (athlete_id = (select auth.uid()) and exists (select 1 from passo.activities a where a.id = activity_id and passo.can_view_activity(a) and a.athlete_id <> (select auth.uid())));
create policy "take back kudos" on passo.kudos for delete to authenticated using (athlete_id = (select auth.uid()));

alter table passo.comments enable row level security;
create policy "read comments" on passo.comments for select to authenticated using (exists (select 1 from passo.activities a where a.id = activity_id and passo.can_view_activity(a)));
create policy "write comments" on passo.comments for insert to authenticated with check (athlete_id = (select auth.uid()) and exists (select 1 from passo.activities a where a.id = activity_id and passo.can_view_activity(a)));
create policy "delete own comments" on passo.comments for delete to authenticated using (athlete_id = (select auth.uid()));

alter table passo.segments enable row level security;
create policy "segments readable" on passo.segments for select to authenticated using (true);
create policy "create segments" on passo.segments for insert to authenticated with check (creator_id = (select auth.uid()));

alter table passo.segment_efforts enable row level security;
create policy "read efforts of visible activities" on passo.segment_efforts for select to authenticated using (exists (select 1 from passo.activities a where a.id = activity_id and passo.can_view_activity(a)));
create policy "own efforts write" on passo.segment_efforts for insert to authenticated with check (athlete_id = (select auth.uid()) and exists (select 1 from passo.activities a where a.id = activity_id and a.athlete_id = (select auth.uid())));
create policy "own efforts delete" on passo.segment_efforts for delete to authenticated using (athlete_id = (select auth.uid()));

alter table passo.clubs enable row level security;
create policy "clubs readable" on passo.clubs for select to authenticated using (true);
create policy "create clubs" on passo.clubs for insert to authenticated with check (created_by = (select auth.uid()));
create policy "admins edit clubs" on passo.clubs for update to authenticated using (exists (select 1 from passo.club_members m where m.club_id = id and m.athlete_id = (select auth.uid()) and m.role = 'admin'));

alter table passo.club_members enable row level security;
create policy "members readable" on passo.club_members for select to authenticated using (true);
create policy "join as self" on passo.club_members for insert to authenticated with check (athlete_id = (select auth.uid()) and role = 'member');
create policy "leave as self" on passo.club_members for delete to authenticated using (athlete_id = (select auth.uid()));

alter table passo.club_posts enable row level security;
create policy "posts readable" on passo.club_posts for select to authenticated using (true);
create policy "members post" on passo.club_posts for insert to authenticated with check (athlete_id = (select auth.uid()) and exists (select 1 from passo.club_members m where m.club_id = club_posts.club_id and m.athlete_id = (select auth.uid())));
create policy "delete own posts" on passo.club_posts for delete to authenticated using (athlete_id = (select auth.uid()));

alter table passo.challenges enable row level security;
create policy "challenges readable" on passo.challenges for select to authenticated using (true);

alter table passo.challenge_joins enable row level security;
create policy "joins readable" on passo.challenge_joins for select to authenticated using (true);
create policy "join challenge" on passo.challenge_joins for insert to authenticated with check (athlete_id = (select auth.uid()));
create policy "update own join" on passo.challenge_joins for update to authenticated using (athlete_id = (select auth.uid()));
create policy "leave challenge" on passo.challenge_joins for delete to authenticated using (athlete_id = (select auth.uid()));

alter table passo.notifications enable row level security;
create policy "own notifications" on passo.notifications for select to authenticated using (athlete_id = (select auth.uid()));
create policy "mark own read" on passo.notifications for update to authenticated using (athlete_id = (select auth.uid()));

-- owner-only tables
alter table passo.gear enable row level security;
create policy "owner" on passo.gear for all to authenticated using (athlete_id = (select auth.uid())) with check (athlete_id = (select auth.uid()));
alter table passo.sessions enable row level security;
create policy "owner" on passo.sessions for all to authenticated using (athlete_id = (select auth.uid())) with check (athlete_id = (select auth.uid()));
alter table passo.routes enable row level security;
create policy "owner" on passo.routes for all to authenticated using (athlete_id = (select auth.uid())) with check (athlete_id = (select auth.uid()));
alter table passo.goals enable row level security;
create policy "owner" on passo.goals for all to authenticated using (athlete_id = (select auth.uid())) with check (athlete_id = (select auth.uid()));
alter table passo.daily_steps enable row level security;
create policy "owner" on passo.daily_steps for all to authenticated using (athlete_id = (select auth.uid())) with check (athlete_id = (select auth.uid()));
alter table passo.starred_segments enable row level security;
create policy "owner" on passo.starred_segments for all to authenticated using (athlete_id = (select auth.uid())) with check (athlete_id = (select auth.uid()));
alter table passo.live enable row level security;
create policy "owner" on passo.live for all to authenticated using (athlete_id = (select auth.uid())) with check (athlete_id = (select auth.uid()));

-- ---------- live sharing functions ----------
-- Runner: create or refresh the share and append new points (kept to the last 6000).
create function passo.push_live(p_share text, p_session uuid, p_snap jsonb, p_points jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if jsonb_typeof(p_points) <> 'array' or jsonb_array_length(p_points) > 400 then raise exception 'points must be an array of at most 400'; end if;
  if pg_column_size(p_snap) > 8192 then raise exception 'snapshot too large'; end if;
  insert into passo.live as l (share_id, athlete_id, session_id, snap, trail)
  values (p_share, (select auth.uid()), p_session, p_snap, p_points)
  on conflict (share_id) do update
    set snap = excluded.snap,
        trail = (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
                  select x from jsonb_array_elements(l.trail || excluded.trail) with ordinality as t(x, n)
                  order by n desc limit 6000) s),
        updated_at = now(), ended = false,
        expires_at = greatest(l.expires_at, now() + interval '2 hours')
    where l.athlete_id = (select auth.uid());
end $$;

create function passo.end_live(p_share text) returns void
language sql security invoker set search_path = '' as $$
  update passo.live set ended = true, expires_at = now() + interval '1 hour', updated_at = now()
  where share_id = p_share and athlete_id = (select auth.uid());
$$;

-- Viewer: anyone holding the link. Returns nothing once the share expired.
create function passo.get_live(p_share text, p_since integer default -1)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'snap', l.snap, 'ended', l.ended, 'updated_at', l.updated_at,
    'name', a.name,
    'trail', (select coalesce(jsonb_agg(p order by (p->>2)::int), '[]'::jsonb) from jsonb_array_elements(l.trail) p where (p->>2)::int > p_since))
  from passo.live l join passo.athletes a on a.id = l.athlete_id
  where l.share_id = p_share and l.expires_at > now()
$$;

-- Following several runners in a race: one call for many share ids.
create function passo.get_live_many(p_shares text[])
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('share_id', l.share_id, 'name', a.name, 'snap', l.snap, 'ended', l.ended, 'updated_at', l.updated_at)), '[]'::jsonb)
  from passo.live l join passo.athletes a on a.id = l.athlete_id
  where l.share_id = any(p_shares[1:20]) and l.expires_at > now()
$$;

-- ---------- grants ----------
grant usage on schema passo to anon, authenticated;
grant select, insert, update, delete on all tables in schema passo to authenticated;
revoke all on all functions in schema passo from public;
grant execute on function passo.can_view_activity(passo.activities) to authenticated;
grant execute on function passo.push_live(text, uuid, jsonb, jsonb), passo.end_live(text) to authenticated;
grant execute on function passo.get_live(text, integer), passo.get_live_many(text[]) to anon, authenticated;

-- updated_at
create function passo.touch() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
create trigger touch before update on passo.athletes for each row execute function passo.touch();
create trigger touch before update on passo.activities for each row execute function passo.touch();
create trigger touch before update on passo.gear for each row execute function passo.touch();
create trigger touch before update on passo.routes for each row execute function passo.touch();
