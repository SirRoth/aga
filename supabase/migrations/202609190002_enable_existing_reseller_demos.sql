update public.customer_slots
set
  status = 'DEMO',
  storage_prefix = coalesce(storage_prefix, 'demos/' || id::text || '/')
where is_reseller = true
  and status = 'VACANT';
