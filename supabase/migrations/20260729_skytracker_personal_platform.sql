begin;

create table if not exists public.skytracker_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 120),
  language text not null default 'en' check (char_length(language) between 2 and 35),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 80),
  distance_unit text not null default 'kilometers'
    check (distance_unit in ('kilometers', 'nautical-miles')),
  altitude_unit text not null default 'meters'
    check (altitude_unit in ('meters', 'feet')),
  speed_unit text not null default 'meters-per-second'
    check (speed_unit in ('meters-per-second', 'knots')),
  theme text not null default 'system' check (theme in ('system', 'dark')),
  account_tier text not null default 'account'
    check (account_tier in ('guest', 'free', 'account', 'pro', 'enterprise')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.skytracker_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('aircraft', 'airport', 'airline', 'flight')),
  stable_id text not null check (char_length(stable_id) between 1 and 120),
  label text check (label is null or char_length(label) <= 200),
  added_at_epoch_millis bigint not null check (added_at_epoch_millis > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, stable_id)
);

alter table public.skytracker_profiles enable row level security;
alter table public.skytracker_favorites enable row level security;

revoke all on public.skytracker_profiles from anon;
revoke all on public.skytracker_favorites from anon;
revoke all on public.skytracker_profiles from authenticated;
revoke all on public.skytracker_favorites from authenticated;
grant select, insert, update, delete on public.skytracker_profiles to authenticated;
grant select, insert, update, delete on public.skytracker_favorites to authenticated;

create policy "skytracker_profiles_select_own"
  on public.skytracker_profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "skytracker_profiles_insert_own"
  on public.skytracker_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "skytracker_profiles_update_own"
  on public.skytracker_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "skytracker_profiles_delete_own"
  on public.skytracker_profiles for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "skytracker_favorites_select_own"
  on public.skytracker_favorites for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "skytracker_favorites_insert_own"
  on public.skytracker_favorites for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "skytracker_favorites_update_own"
  on public.skytracker_favorites for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "skytracker_favorites_delete_own"
  on public.skytracker_favorites for delete to authenticated
  using ((select auth.uid()) = user_id);

commit;
