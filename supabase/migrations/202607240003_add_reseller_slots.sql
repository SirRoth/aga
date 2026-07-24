alter table public.customer_slots
add column if not exists is_reseller boolean not null default false;

alter table public.customer_slots
add column if not exists reseller_company_name text;
