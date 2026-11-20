-- Run in Supabase SQL Editor after creating your owner account.
-- Replace the UUID placeholder with your actual user UUID from Authentication > Users.
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_name text not null check (activity_name in ('Meditation','Gym','Reading')),
  activity_date date not null,
  minutes integer not null check (minutes between 1 and 1440),
  created_at timestamptz not null default now()
);
create index if not exists activities_user_date_idx on public.activities(user_id,activity_date desc);
alter table public.activities enable row level security;
revoke all on public.activities from anon, authenticated;
grant select,insert on public.activities to authenticated;
create policy owner_select on public.activities for select to authenticated
  using (auth.uid() = user_id and auth.uid() = 'REPLACE_WITH_OWNER_UUID'::uuid);
create policy owner_insert on public.activities for insert to authenticated
  with check (auth.uid() = user_id and auth.uid() = 'REPLACE_WITH_OWNER_UUID'::uuid);
