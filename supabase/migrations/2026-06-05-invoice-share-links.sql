-- Secure, time-limited invoice sharing for WhatsApp.
--
-- The receipt PDF is generated server-side, stored in a PRIVATE bucket, and
-- shared as a link on the gym's OWN domain (/r/<token>) that streams the file
-- via the service role. The Supabase storage URL is never exposed. Links carry
-- an explicit expires_at (default 7 days) enforced by the route handler.

-- Private bucket — only the service role (server) can read/write. No public
-- policies are added, so anon/authenticated cannot list or fetch objects.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

create table if not exists public.pulse_invoice_links (
  id           uuid primary key default gen_random_uuid(),   -- unguessable share token
  gym_id       uuid not null references public.pulse_gyms(id)     on delete cascade,
  payment_id   uuid not null references public.pulse_payments(id) on delete cascade,
  storage_path text not null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  unique (payment_id)   -- one active link per payment; re-sends refresh it
);

create index if not exists pulse_invoice_links_expires_at_idx on public.pulse_invoice_links (expires_at);
create index if not exists pulse_invoice_links_gym_id_idx     on public.pulse_invoice_links (gym_id);

-- Deny-by-default: enable RLS with no policies. Only the service-role server
-- (admin client) touches this table; clients never read it directly.
alter table public.pulse_invoice_links enable row level security;
