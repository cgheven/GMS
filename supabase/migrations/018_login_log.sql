-- Login log: record every successful sign-in via auth.users trigger

create table if not exists hms_login_log (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id) on delete set null,
  email        text        not null,
  logged_in_at timestamptz not null,
  created_at   timestamptz not null default now()
);

alter table hms_login_log enable row level security;

-- Admins see all; users see their own
create policy "admins read login log"
  on hms_login_log for select
  using (hms_is_admin());

create policy "users read own login log"
  on hms_login_log for select
  using (auth.uid() = user_id);

create index on hms_login_log (logged_in_at desc);
create index on hms_login_log (user_id);

-- Trigger function: fires on auth.users UPDATE when last_sign_in_at changes
create or replace function hms_log_user_login()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.last_sign_in_at is distinct from NEW.last_sign_in_at
     and NEW.last_sign_in_at is not null then
    insert into hms_login_log (user_id, email, logged_in_at)
    values (NEW.id, NEW.email, NEW.last_sign_in_at);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_hms_log_user_login on auth.users;

create trigger trg_hms_log_user_login
  after update on auth.users
  for each row
  execute function hms_log_user_login();
