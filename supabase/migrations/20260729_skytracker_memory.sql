begin;

alter table public.skytracker_profiles
  add column if not exists ai_expertise_level text not null default 'beginner'
    check (ai_expertise_level in ('beginner', 'enthusiast', 'professional')),
  add column if not exists ai_conversation_style text not null default 'concise'
    check (ai_conversation_style in ('concise', 'balanced', 'technical')),
  add column if not exists ai_interests text[] not null default '{}',
  add column if not exists ai_favorite_topics text[] not null default '{}';

create table if not exists public.skytracker_memory (
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in (
    'favorite-airline',
    'favorite-aircraft',
    'favorite-airport',
    'favorite-route',
    'spotting-interest'
  )),
  value text not null check (char_length(value) between 1 and 120),
  label text check (label is null or char_length(label) <= 160),
  created_at_epoch_millis bigint not null check (created_at_epoch_millis > 0),
  updated_at_epoch_millis bigint not null check (updated_at_epoch_millis > 0),
  primary key (user_id, category, value)
);

alter table public.skytracker_memory enable row level security;
revoke all on public.skytracker_memory from anon;
revoke all on public.skytracker_memory from authenticated;
grant select, insert, update, delete on public.skytracker_memory to authenticated;

create policy "skytracker_memory_select_own"
  on public.skytracker_memory for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "skytracker_memory_insert_own"
  on public.skytracker_memory for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "skytracker_memory_update_own"
  on public.skytracker_memory for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "skytracker_memory_delete_own"
  on public.skytracker_memory for delete to authenticated
  using ((select auth.uid()) = user_id);

commit;
