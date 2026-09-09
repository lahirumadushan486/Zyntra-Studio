-- Zyntra Studio customer reviews: Supabase setup
-- Run this file in the Supabase SQL Editor for the project used by script.js.
-- The browser must use only the project's publishable/anon key, never service_role.
--
-- Setup steps:
-- 1. Create/select a Supabase project, open SQL Editor, and run this entire file.
-- 2. In the Supabase project API settings, copy the Project URL and the public
--    publishable (or legacy anon) key.
-- 3. Replace SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY near the top of script.js.
-- 4. Keep REVIEW_AUTO_PUBLISH=true for the active policy below. Before changing
--    it to false, run the FUTURE MODERATION MODE policy block at the end.
-- 5. Test an approved text-only review and a photo review from the deployed site.

create extension if not exists pgcrypto;

create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  review_text text not null,
  rating smallint not null,
  photo_url text,
  status text not null default 'approved',
  created_at timestamptz not null default now(),
  constraint customer_reviews_name_length check (char_length(btrim(customer_name)) between 2 and 80),
  constraint customer_reviews_text_length check (char_length(btrim(review_text)) between 20 and 500),
  constraint customer_reviews_rating_range check (rating between 1 and 5),
  constraint customer_reviews_status_values check (status in ('approved', 'pending', 'rejected')),
  constraint customer_reviews_photo_url check (photo_url is null or (char_length(photo_url) <= 2048 and photo_url like 'https://%'))
);

create index if not exists customer_reviews_public_feed_idx
  on public.customer_reviews (status, created_at desc);

alter table public.customer_reviews enable row level security;

revoke all on table public.customer_reviews from anon, authenticated;
grant select on table public.customer_reviews to anon, authenticated;
grant insert (customer_name, review_text, rating, photo_url, status)
  on table public.customer_reviews to anon, authenticated;

drop policy if exists "Public can read approved reviews" on public.customer_reviews;
create policy "Public can read approved reviews"
  on public.customer_reviews
  for select
  to anon, authenticated
  using (status = 'approved');

-- Current mode: REVIEW_AUTO_PUBLISH = true.
-- Visitors may insert validated rows only as approved. They cannot update or delete.
drop policy if exists "Public can submit auto-published reviews" on public.customer_reviews;
drop policy if exists "Public can submit pending reviews" on public.customer_reviews;
create policy "Public can submit auto-published reviews"
  on public.customer_reviews
  for insert
  to anon, authenticated
  with check (
    status = 'approved'
    and char_length(btrim(customer_name)) between 2 and 80
    and char_length(btrim(review_text)) between 20 and 500
    and rating between 1 and 5
    and (photo_url is null or (char_length(photo_url) <= 2048 and photo_url like 'https://%'))
  );

-- Storage bucket for compressed review photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-photos',
  'review-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view review photos" on storage.objects;
create policy "Public can view review photos"
  on storage.objects
  for select
  to public
  using (bucket_id = 'review-photos');

drop policy if exists "Public can upload generated review photos" on storage.objects;
create policy "Public can upload generated review photos"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'review-photos'
    and (storage.foldername(name))[1] = 'public'
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );

-- No public UPDATE or DELETE policies are created for customer_reviews or
-- review-photos. Administrative moderation must use authenticated dashboard
-- access or a secure server/Edge Function, never elevated browser credentials.

-- FUTURE MODERATION MODE
-- When changing REVIEW_AUTO_PUBLISH to false in script.js, run this block:
--
-- alter table public.customer_reviews alter column status set default 'pending';
-- drop policy if exists "Public can submit auto-published reviews" on public.customer_reviews;
-- drop policy if exists "Public can submit pending reviews" on public.customer_reviews;
-- create policy "Public can submit pending reviews"
--   on public.customer_reviews
--   for insert
--   to anon, authenticated
--   with check (
--     status = 'pending'
--     and char_length(btrim(customer_name)) between 2 and 80
--     and char_length(btrim(review_text)) between 20 and 500
--     and rating between 1 and 5
--     and (photo_url is null or (char_length(photo_url) <= 2048 and photo_url like 'https://%'))
--   );
--
-- Keep the approved-only SELECT policy unchanged. Approve or reject records only
-- through the Supabase dashboard or a secured admin service.

-- Recommended production hardening outside SQL:
-- 1. Enable Supabase CAPTCHA/Turnstile or route submissions through an Edge Function.
-- 2. Add server-side rate limiting before a high-traffic launch.
-- 3. Periodically remove uploaded objects that are not referenced by a review row.
