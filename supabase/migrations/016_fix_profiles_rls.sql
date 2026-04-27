-- Fix recursive RLS on hms_profiles.
-- The "Admin reads all profiles" policy had a subquery that reads hms_profiles
-- inside a hms_profiles RLS policy — infinite recursion → profile always null.
-- Fix: SECURITY DEFINER function bypasses RLS for the is_admin lookup.

create or replace function hms_is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce(
    (select is_admin from hms_profiles where id = auth.uid()),
    false
  )
$$;

-- Drop the broken recursive policy
drop policy if exists "Admin reads all profiles" on hms_profiles;

-- Non-recursive replacement: own row always readable; admin can read all
create policy "Users read own profile, admin reads all"
  on hms_profiles for select
  using (auth.uid() = id or hms_is_admin());
