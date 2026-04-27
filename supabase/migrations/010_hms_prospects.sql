create table if not exists hms_prospects (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  owner_name  text,
  phone       text,
  area        text,
  address     text,
  status      text        not null default 'pending'
                check (status in ('pending', 'visited', 'onboarded')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table hms_prospects enable row level security;

-- SECURITY DEFINER bypasses RLS on hms_profiles, avoiding infinite recursion
create or replace function hms_is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from hms_profiles
    where id = auth.uid() and is_admin = true
  );
$$;

create policy "Admins can manage prospects"
  on hms_prospects for all
  using (hms_is_admin());
