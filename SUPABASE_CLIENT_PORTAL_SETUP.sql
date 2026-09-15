-- Zyntra Studio Client Portal — Supabase setup
-- Run this entire file in the Supabase SQL Editor.
-- It does not modify customer_reviews or the existing review-photos bucket.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '', business_name text not null default '', phone text not null default '', avatar_url text,
  role text not null default 'client' check (role in ('client','admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.client_projects (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.profiles(id) on delete cascade,
  project_name text not null check (char_length(btrim(project_name)) between 1 and 180), service_type text not null default '', description text not null default '',
  status text not null default 'Planning' check (status in ('Planning','In Progress','Waiting for Client','Revision','Completed','On Hold')),
  progress integer not null default 0 check (progress between 0 and 100), start_date date, due_date date,
  priority text not null default 'Normal' check (priority in ('Low','Normal','High','Urgent')), archived boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint client_projects_date_order check (due_date is null or start_date is null or due_date >= start_date)
);

create table if not exists public.content_calendar (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.client_projects(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade, title text not null check (char_length(btrim(title)) between 1 and 180),
  content_type text not null default '', platform text not null default '', scheduled_date timestamptz not null,
  status text not null default 'Planned' check (status in ('Planned','In Production','Ready for Review','Approved','Scheduled','Published')),
  caption_preview text not null default '', notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.project_drafts (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.client_projects(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade, title text not null check (char_length(btrim(title)) between 1 and 180),
  description text not null default '', storage_path text not null unique, file_name text not null, file_type text not null,
  version integer not null default 1 check (version >= 1),
  status text not null default 'Awaiting Review' check (status in ('Awaiting Review','Approved','Revision Requested','Replaced')),
  uploaded_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.revision_requests (
  id uuid primary key default gen_random_uuid(), draft_id uuid not null references public.project_drafts(id) on delete cascade,
  project_id uuid not null references public.client_projects(id) on delete cascade, client_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  status text not null default 'Open' check (status in ('Open','In Progress','Resolved')), admin_response text,
  created_at timestamptz not null default now(), resolved_at timestamptz
);

create table if not exists public.deliverables (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.client_projects(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade, title text not null check (char_length(btrim(title)) between 1 and 180),
  description text not null default '', storage_path text not null unique, file_name text not null, file_size bigint not null default 0 check (file_size >= 0),
  uploaded_at timestamptz not null default now(), expires_at timestamptz
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.client_projects(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade, invoice_number text not null unique,
  description text not null default '', amount numeric(14,2) not null check (amount >= 0), currency text not null default 'LKR',
  issue_date date not null, due_date date not null,
  payment_status text not null default 'Pending' check (payment_status in ('Pending','Partially Paid','Paid','Overdue','Cancelled')),
  payment_date date, payment_method text, receipt_storage_path text, notes text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint invoices_date_order check (due_date >= issue_date)
);

create table if not exists public.portal_notifications (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.client_projects(id) on delete cascade, title text not null, message text not null,
  notification_type text not null default 'general', read boolean not null default false, created_at timestamptz not null default now()
);

create table if not exists public.portal_activity (
  id bigint generated by default as identity primary key, actor_id uuid references public.profiles(id) on delete set null,
  action text not null, entity_type text not null, entity_id text, details text, created_at timestamptz not null default now()
);

create index if not exists client_projects_client_idx on public.client_projects(client_id, archived, created_at desc);
create index if not exists content_calendar_client_idx on public.content_calendar(client_id, scheduled_date);
create index if not exists content_calendar_project_idx on public.content_calendar(project_id);
create index if not exists project_drafts_client_idx on public.project_drafts(client_id, status, uploaded_at desc);
create index if not exists project_drafts_project_idx on public.project_drafts(project_id);
create index if not exists revision_requests_client_idx on public.revision_requests(client_id, status, created_at desc);
create index if not exists revision_requests_draft_idx on public.revision_requests(draft_id);
create index if not exists revision_requests_project_idx on public.revision_requests(project_id);
create index if not exists deliverables_client_idx on public.deliverables(client_id, uploaded_at desc);
create index if not exists deliverables_project_idx on public.deliverables(project_id);
create index if not exists invoices_client_idx on public.invoices(client_id, payment_status, issue_date desc);
create index if not exists invoices_project_idx on public.invoices(project_id);
create index if not exists portal_notifications_client_idx on public.portal_notifications(client_id, read, created_at desc);
create index if not exists portal_notifications_project_idx on public.portal_notifications(project_id);
create index if not exists portal_activity_created_idx on public.portal_activity(created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin new.updated_at = now(); return new; end;
$$;

do $$ declare table_name text; begin
  foreach table_name in array array['profiles','client_projects','content_calendar','project_drafts','invoices'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name);
  end loop;
end $$;

create or replace function public.is_portal_admin()
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true);
$$;

create or replace function public.handle_new_portal_user()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  insert into public.profiles(id, full_name, business_name, phone, role, active)
  values(new.id, coalesce(new.raw_user_meta_data ->> 'full_name',''), coalesce(new.raw_user_meta_data ->> 'business_name',''), coalesce(new.raw_user_meta_data ->> 'phone',''), 'client', true)
  on conflict(id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_create_portal_profile on auth.users;
create trigger on_auth_user_created_create_portal_profile after insert on auth.users for each row execute function public.handle_new_portal_user();

-- Backfill profiles for Auth users created before this setup. Every backfilled user is safely a client.
insert into public.profiles(id, full_name, business_name, phone, role, active)
select id, coalesce(raw_user_meta_data ->> 'full_name',''), coalesce(raw_user_meta_data ->> 'business_name',''), coalesce(raw_user_meta_data ->> 'phone',''), 'client', true
from auth.users on conflict(id) do nothing;

create or replace function public.protect_profile_security_fields()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null or public.is_portal_admin() then return new; end if;
  if old.id <> auth.uid() or new.id <> old.id or new.role <> old.role or new.active <> old.active or new.created_at <> old.created_at then
    raise exception 'Profile security fields cannot be changed';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_security_fields on public.profiles;
create trigger protect_profile_security_fields before update on public.profiles for each row execute function public.protect_profile_security_fields();

create or replace function public.protect_notification_client_update()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null or public.is_portal_admin() then return new; end if;
  if old.client_id <> auth.uid() or new.client_id <> old.client_id or (to_jsonb(new) - 'read') <> (to_jsonb(old) - 'read') then
    raise exception 'Only notification read status can be changed';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_notification_client_update on public.portal_notifications;
create trigger protect_notification_client_update before update on public.portal_notifications for each row execute function public.protect_notification_client_update();

create or replace function public.ensure_project_client_match()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if not exists(select 1 from public.client_projects where id = new.project_id and client_id = new.client_id) then
    raise exception 'Project and client assignment do not match';
  end if;
  return new;
end;
$$;
do $$ declare table_name text; begin
  foreach table_name in array array['content_calendar','project_drafts','revision_requests','deliverables','invoices'] loop
    execute format('drop trigger if exists ensure_project_client_match on public.%I', table_name);
    execute format('create trigger ensure_project_client_match before insert or update on public.%I for each row execute function public.ensure_project_client_match()', table_name);
  end loop;
end $$;

create or replace function public.ensure_revision_draft_match()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if not exists(select 1 from public.project_drafts where id = new.draft_id and project_id = new.project_id and client_id = new.client_id) then
    raise exception 'Draft, project and client assignment do not match';
  end if;
  return new;
end;
$$;
drop trigger if exists ensure_revision_draft_match on public.revision_requests;
create trigger ensure_revision_draft_match before insert or update on public.revision_requests for each row execute function public.ensure_revision_draft_match();

create or replace function public.mark_draft_revision_requested()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  update public.project_drafts set status='Revision Requested' where id=new.draft_id and status='Awaiting Review';
  return new;
end;
$$;
drop trigger if exists mark_draft_revision_requested on public.revision_requests;
create trigger mark_draft_revision_requested after insert on public.revision_requests for each row execute function public.mark_draft_revision_requested();

create or replace function public.update_my_profile(new_full_name text, new_business_name text, new_phone text, new_avatar_url text default null)
returns public.profiles language plpgsql security definer set search_path = pg_catalog, public as $$
declare result public.profiles;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(btrim(coalesce(new_full_name,''))) not between 1 and 120 then raise exception 'Invalid full name'; end if;
  update public.profiles set full_name=btrim(new_full_name), business_name=left(btrim(coalesce(new_business_name,'')),160), phone=left(btrim(coalesce(new_phone,'')),40), avatar_url=nullif(left(btrim(coalesce(new_avatar_url,'')),2048),'') where id=auth.uid() and active=true returning * into result;
  if result.id is null then raise exception 'Profile unavailable'; end if;
  return result;
end;
$$;

create or replace function public.approve_own_draft(target_draft_id uuid)
returns public.project_drafts language plpgsql security definer set search_path = pg_catalog, public as $$
declare result public.project_drafts;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.project_drafts set status='Approved' where id=target_draft_id and client_id=auth.uid() and status='Awaiting Review' returning * into result;
  if result.id is null then raise exception 'Draft unavailable for approval'; end if;
  return result;
end;
$$;

create or replace function public.log_portal_activity()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare row_id text; detail text;
begin
  row_id := coalesce((case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id','');
  detail := case when tg_table_name='client_projects' then coalesce((case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'project_name','') when tg_table_name='revision_requests' then 'Revision status updated' else '' end;
  insert into public.portal_activity(actor_id,action,entity_type,entity_id,details) values(auth.uid(),tg_op,tg_table_name,row_id,detail);
  return case when tg_op='DELETE' then old else new end;
end;
$$;
do $$ declare table_name text; begin
  foreach table_name in array array['profiles','client_projects','content_calendar','project_drafts','revision_requests','deliverables','invoices','portal_notifications'] loop
    execute format('drop trigger if exists log_portal_activity on public.%I', table_name);
    execute format('create trigger log_portal_activity after insert or update or delete on public.%I for each row execute function public.log_portal_activity()', table_name);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.client_projects enable row level security;
alter table public.content_calendar enable row level security;
alter table public.project_drafts enable row level security;
alter table public.revision_requests enable row level security;
alter table public.deliverables enable row level security;
alter table public.invoices enable row level security;
alter table public.portal_notifications enable row level security;
alter table public.portal_activity enable row level security;

revoke all on public.profiles, public.client_projects, public.content_calendar, public.project_drafts, public.revision_requests, public.deliverables, public.invoices, public.portal_notifications, public.portal_activity from anon;
grant select,insert,update,delete on public.profiles, public.client_projects, public.content_calendar, public.project_drafts, public.revision_requests, public.deliverables, public.invoices, public.portal_notifications, public.portal_activity to authenticated;
grant usage,select on sequence public.portal_activity_id_seq to authenticated;

drop policy if exists profiles_self_select on public.profiles; create policy profiles_self_select on public.profiles for select to authenticated using(id=auth.uid());
drop policy if exists profiles_self_update on public.profiles; create policy profiles_self_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
drop policy if exists profiles_admin_all on public.profiles; create policy profiles_admin_all on public.profiles for all to authenticated using(public.is_portal_admin()) with check(public.is_portal_admin());

do $$ declare table_name text; begin
  foreach table_name in array array['client_projects','content_calendar','project_drafts','revision_requests','deliverables','invoices','portal_notifications'] loop
    execute format('drop policy if exists %I on public.%I', table_name||'_client_select', table_name);
    execute format('create policy %I on public.%I for select to authenticated using(client_id=auth.uid())', table_name||'_client_select', table_name);
    execute format('drop policy if exists %I on public.%I', table_name||'_admin_all', table_name);
    execute format('create policy %I on public.%I for all to authenticated using(public.is_portal_admin()) with check(public.is_portal_admin())', table_name||'_admin_all', table_name);
  end loop;
end $$;

drop policy if exists revision_requests_client_insert on public.revision_requests;
create policy revision_requests_client_insert on public.revision_requests for insert to authenticated with check(
  client_id=auth.uid() and status='Open' and admin_response is null and resolved_at is null
  and exists(select 1 from public.project_drafts d where d.id=draft_id and d.project_id=project_id and d.client_id=auth.uid())
);
drop policy if exists portal_notifications_client_update on public.portal_notifications;
create policy portal_notifications_client_update on public.portal_notifications for update to authenticated using(client_id=auth.uid()) with check(client_id=auth.uid());
drop policy if exists portal_activity_admin_select on public.portal_activity;
create policy portal_activity_admin_select on public.portal_activity for select to authenticated using(public.is_portal_admin());

revoke execute on function public.is_portal_admin(), public.update_my_profile(text,text,text,text), public.approve_own_draft(uuid) from public, anon;
grant execute on function public.is_portal_admin(), public.update_my_profile(text,text,text,text), public.approve_own_draft(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('client-drafts','client-drafts',false,52428800,array['image/jpeg','image/png','image/webp','video/mp4','video/webm','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
('client-deliverables','client-deliverables',false,524288000,array['image/jpeg','image/png','image/webp','video/mp4','video/webm','audio/mpeg','audio/wav','application/pdf','application/zip','application/octet-stream','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
('client-documents','client-documents',false,26214400,array['image/jpeg','image/png','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists portal_clients_read_own_files on storage.objects;
create policy portal_clients_read_own_files on storage.objects for select to authenticated using(
  (storage.foldername(name))[1]=auth.uid()::text and (
    (bucket_id='client-drafts' and exists(select 1 from public.project_drafts d where d.storage_path=name and d.client_id=auth.uid())) or
    (bucket_id='client-deliverables' and exists(select 1 from public.deliverables d where d.storage_path=name and d.client_id=auth.uid() and (d.expires_at is null or d.expires_at>now()))) or
    (bucket_id='client-documents' and exists(select 1 from public.invoices i where i.receipt_storage_path=name and i.client_id=auth.uid()))
  )
);
drop policy if exists portal_admin_read_files on storage.objects;
create policy portal_admin_read_files on storage.objects for select to authenticated using(bucket_id in ('client-drafts','client-deliverables','client-documents') and public.is_portal_admin());
drop policy if exists portal_admin_upload_files on storage.objects;
create policy portal_admin_upload_files on storage.objects for insert to authenticated with check(
  bucket_id in ('client-drafts','client-deliverables','client-documents') and public.is_portal_admin()
  and exists(select 1 from public.client_projects p where p.client_id::text=(storage.foldername(name))[1] and p.id::text=(storage.foldername(name))[2])
);
drop policy if exists portal_admin_update_files on storage.objects;
create policy portal_admin_update_files on storage.objects for update to authenticated using(bucket_id in ('client-drafts','client-deliverables','client-documents') and public.is_portal_admin()) with check(bucket_id in ('client-drafts','client-deliverables','client-documents') and public.is_portal_admin());
drop policy if exists portal_admin_delete_files on storage.objects;
create policy portal_admin_delete_files on storage.objects for delete to authenticated using(bucket_id in ('client-drafts','client-deliverables','client-documents') and public.is_portal_admin());

-- FIRST ADMIN (run once after creating/inviting the user in Authentication):
-- update public.profiles set role='admin' where id=(select id from auth.users where email='YOUR_ADMIN_EMAIL');
