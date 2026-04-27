-- Audit log for admin actions.
-- actor_email is stored at write time so history stays accurate after user deletion.

create table hms_audit_log (
  id          uuid        primary key default gen_random_uuid(),
  actor_id    uuid,                              -- nullable: user may be deleted later
  actor_email text        not null default '',
  action      text        not null,              -- e.g. 'user.create', 'hostel.delete'
  entity      text        not null,              -- 'user', 'hostel'
  entity_id   text,                              -- ID of the affected record
  meta        jsonb,                             -- extra context (name, email, changes…)
  created_at  timestamptz not null default now()
);

alter table hms_audit_log enable row level security;

-- Only admins can read the audit log
create policy "Admins read audit log"
  on hms_audit_log for select
  using (hms_is_admin());

-- Service role (admin client) inserts — RLS is bypassed for service role,
-- but an explicit policy keeps intent clear if role ever changes.
create policy "Service role inserts audit log"
  on hms_audit_log for insert
  with check (true);

create index idx_hms_audit_log_created  on hms_audit_log (created_at desc);
create index idx_hms_audit_log_actor    on hms_audit_log (actor_id);
create index idx_hms_audit_log_action   on hms_audit_log (action);
