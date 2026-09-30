-- Phase 5: persistent private equipment photos.
-- Supabase currently supports bucket creation via SQL.

alter table public.de_exercise_equipment_images
  add column if not exists is_primary boolean not null default false;

create unique index if not exists dex_equipment_images_primary_idx
  on public.de_exercise_equipment_images(user_id, equipment_id)
  where is_primary;

create unique index if not exists dex_equipment_images_storage_path_idx
  on public.de_exercise_equipment_images(storage_path);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'de-exercise-equipment',
  'de-exercise-equipment',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

drop policy if exists "dex equipment photos insert" on storage.objects;
drop policy if exists "dex equipment photos select" on storage.objects;
drop policy if exists "dex equipment photos update" on storage.objects;
drop policy if exists "dex equipment photos delete" on storage.objects;

create policy "dex equipment photos insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'de-exercise-equipment'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "dex equipment photos select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'de-exercise-equipment'
  and owner_id = (select auth.uid())::text
);

create policy "dex equipment photos update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'de-exercise-equipment'
  and owner_id = (select auth.uid())::text
)
with check (
  bucket_id = 'de-exercise-equipment'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "dex equipment photos delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'de-exercise-equipment'
  and owner_id = (select auth.uid())::text
);
