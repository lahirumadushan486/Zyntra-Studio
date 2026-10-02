-- Run this file in the Supabase SQL Editor before deploying share-package-quotation.
-- The bucket is private: quotation images are accessible only through expiring signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quotation-images', 'quotation-images', false, 8388608, array['image/png'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.quotation_share_requests (
  id bigint generated always as identity primary key,
  client_hash text not null check (length(client_hash) = 64),
  created_at timestamptz not null default now()
);

create index if not exists quotation_share_requests_rate_idx
  on public.quotation_share_requests (client_hash, created_at desc);

alter table public.quotation_share_requests enable row level security;
revoke all on table public.quotation_share_requests from anon, authenticated;
grant select, insert, delete on table public.quotation_share_requests to service_role;
grant usage, select on sequence public.quotation_share_requests_id_seq to service_role;

-- No anon/authenticated Storage policies are created. The Edge Function uses its
-- server-side service role for uploads, cleanup and signed URL generation.
