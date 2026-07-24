alter table public.customer_slots
add column if not exists allow_videos boolean not null default false;
