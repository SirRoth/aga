alter table public.customer_slots
rename column gdrive_folder_id to storage_prefix;

alter table public.photos
rename column gdrive_file_id to object_key;
