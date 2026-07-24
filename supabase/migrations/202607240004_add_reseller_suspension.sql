alter table public.customer_slots
add column if not exists reseller_suspended boolean not null default false;
