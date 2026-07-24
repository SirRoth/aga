create extension if not exists pgcrypto;

do $$ begin
  create type public.profile_role as enum ('admin');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.slot_status as enum ('VACANT', 'ACTIVE', 'EXPIRED_GRACE');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.profile_role not null default 'admin',
  created_at timestamptz not null default now()
);

create table if not exists public.customer_slots (
  id uuid primary key default gen_random_uuid(),
  slot_name text not null,
  storage_limit_bytes bigint not null default 2147483648 check (storage_limit_bytes > 0),
  storage_used_bytes bigint not null default 0 check (storage_used_bytes >= 0),
  allow_videos boolean not null default false,
  is_reseller boolean not null default false,
  reseller_company_name text,
  status public.slot_status not null default 'VACANT',
  event_name text,
  upload_slug text unique,
  download_token text unique,
  storage_prefix text,
  event_start_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.customer_slots(id) on delete cascade,
  object_key text not null,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes >= 0),
  uploaded_at timestamptz not null default now()
);

create index if not exists customer_slots_status_idx on public.customer_slots(status);
create index if not exists customer_slots_event_start_at_idx on public.customer_slots(event_start_at);
create index if not exists photos_slot_id_idx on public.photos(slot_id);

alter table public.profiles enable row level security;
alter table public.customer_slots enable row level security;
alter table public.photos enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

drop policy if exists "Admins can read profiles" on public.profiles;
create policy "Admins can read profiles"
on public.profiles
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can manage customer slots" on public.customer_slots;
create policy "Admins can manage customer slots"
on public.customer_slots
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can read photos" on public.photos;
create policy "Admins can read photos"
on public.photos
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can delete photos" on public.photos;
create policy "Admins can delete photos"
on public.photos
for delete
to authenticated
using (public.is_admin());

insert into public.customer_slots (slot_name)
values
  ('Box 01 / Slot A'),
  ('Box 01 / Slot B'),
  ('Box 02 / Slot A'),
  ('Box 02 / Slot B')
on conflict do nothing;
