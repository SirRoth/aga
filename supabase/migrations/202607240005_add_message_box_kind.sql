do $$ begin
  create type public.slot_box_kind as enum ('PHOTO', 'MESSAGE');
exception
  when duplicate_object then null;
end $$;

alter table public.customer_slots
add column if not exists box_kind public.slot_box_kind not null default 'PHOTO';

update public.customer_slots
set box_kind = 'PHOTO'
where box_kind is null;
