alter table hms_tenants
  add column if not exists billing_type text not null default 'monthly',
  add column if not exists daily_rate numeric(10,2) not null default 0;
