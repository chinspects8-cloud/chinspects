-- =============================================================================
-- CHI admin portal — Supabase setup
--
-- Run this ONCE: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- It is safe to run again; every step checks before it creates anything.
-- =============================================================================

-- 1. The table that holds the whole website content as a single JSON row. ----
create table if not exists public.site_content (
  id         integer primary key,
  content    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Exactly one row, with id = 1. The dashboard always reads and writes this row.
insert into public.site_content (id, content)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

-- 2. Row level security. ------------------------------------------------------
-- This is what actually protects the site. The anon key shipped in the page is
-- public, so anyone can read — which is fine, it is website copy. Writing is
-- restricted to a signed-in user, which means knowing the access code.
alter table public.site_content enable row level security;

drop policy if exists "site content is publicly readable" on public.site_content;
create policy "site content is publicly readable"
  on public.site_content
  for select
  to anon, authenticated
  using (true);

drop policy if exists "only signed-in users can edit site content" on public.site_content;
create policy "only signed-in users can edit site content"
  on public.site_content
  for update
  to authenticated
  using (true)
  with check (true);

-- 3. Image storage. -----------------------------------------------------------
-- A public bucket: images need to be readable by visitors, uploadable only by
-- the signed-in admin.
insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true)
on conflict (id) do nothing;

drop policy if exists "site images are publicly readable" on storage.objects;
create policy "site images are publicly readable"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'site-images');

drop policy if exists "only signed-in users can upload site images" on storage.objects;
create policy "only signed-in users can upload site images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'site-images');

drop policy if exists "only signed-in users can replace site images" on storage.objects;
create policy "only signed-in users can replace site images"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'site-images');

drop policy if exists "only signed-in users can delete site images" on storage.objects;
create policy "only signed-in users can delete site images"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'site-images');

-- 4. Booking requests inbox. -------------------------------------------------
-- The schedule form copies each request here (it still goes to Netlify Forms
-- too). Visitors can ADD a request but can never read, change or delete one;
-- only the signed-in admin portal can.
create table if not exists public.bookings (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  status         text not null default 'new'
                 check (status in ('new','contacted','scheduled','completed','cancelled')),
  first_name     text check (char_length(first_name) <= 120),
  last_name      text check (char_length(last_name) <= 120),
  email          text check (char_length(email) <= 254),
  phone          text check (char_length(phone) <= 40),
  address        text check (char_length(address) <= 300),
  city           text check (char_length(city) <= 120),
  state          text check (char_length(state) <= 40),
  zip            text check (char_length(zip) <= 20),
  property_type  text check (char_length(property_type) <= 80),
  square_feet    text check (char_length(square_feet) <= 20),
  services       text[] not null default '{}' check (cardinality(services) <= 10),
  preferred_date text check (char_length(preferred_date) <= 20),
  preferred_time text check (char_length(preferred_time) <= 20),
  message        text check (char_length(message) <= 2000),
  admin_notes    text check (char_length(admin_notes) <= 4000)
);

alter table public.bookings enable row level security;

drop policy if exists "visitors can submit booking requests" on public.bookings;
create policy "visitors can submit booking requests"
  on public.bookings
  for insert
  to anon, authenticated
  with check (status = 'new' and admin_notes is null);

drop policy if exists "admin can read booking requests" on public.bookings;
create policy "admin can read booking requests"
  on public.bookings
  for select
  to authenticated
  using (true);

drop policy if exists "admin can update booking requests" on public.bookings;
create policy "admin can update booking requests"
  on public.bookings
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "admin can delete booking requests" on public.bookings;
create policy "admin can delete booking requests"
  on public.bookings
  for delete
  to authenticated
  using (true);

create index if not exists bookings_created_at_idx on public.bookings (created_at desc);

-- =============================================================================
-- Done. Two things are still done by hand in the Supabase dashboard:
--
--   Authentication -> Users -> "Add user"
--       email:    the address in assets/cms-config.js
--       password: your ACCESS CODE (at least 8 characters; this is what
--                 you type to unlock the admin portal)
--       tick "Auto Confirm User"
--
--   Authentication -> Sign In / Providers
--       turn OFF "Allow new users to sign up", so yours stays the only account
-- =============================================================================
