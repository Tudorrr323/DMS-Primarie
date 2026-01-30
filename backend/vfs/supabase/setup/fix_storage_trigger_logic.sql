-- Fix Storage Calculation Logic
-- Problema anterioară: La ștergerea în cascadă, trigger-ul de pe versions nu mai găsea fișierul părinte pentru a afla space_id.

-- 1. Drop old triggers and functions
drop trigger if exists on_version_change on vfs.file_versions;
drop function if exists vfs.sync_storage_usage();

-- 2. Helper Function: Recalculate usage for a specific space
create or replace function vfs.recalc_space_usage(_space_id uuid)
returns void
language plpgsql
security definer
set search_path = vfs, public
as $$
begin
  update vfs.user_space 
  set storage_used = (
    select coalesce(sum(fv.size), 0)
    from vfs.files f
    join vfs.file_versions fv on f.id = fv.file_id
    where f.space_id = _space_id
  )
  where id = _space_id;
end;
$$;

-- 3. Trigger 1: File Versions (For Uploads and Version Updates)
create or replace function vfs.trigger_usage_on_versions()
returns trigger as $$
declare
  target_space_id uuid;
begin
  -- Doar pentru INSERT sau UPDATE. DELETE-ul este gestionat de trigger-ul de pe files (cascade).
  -- Dar dacă ștergem doar o versiune (fără ștergerea fișierului), trebuie tratat.
  
  if (TG_OP = 'DELETE') then
     -- Încercăm să găsim space_id. Dacă fișierul părinte a fost șters deja, va fi null.
     select space_id into target_space_id from vfs.files where id = OLD.file_id;
  else
     select space_id into target_space_id from vfs.files where id = NEW.file_id;
  end if;

  if target_space_id is not null then
      perform vfs.recalc_space_usage(target_space_id);
  end if;
  
  return null;
end;
$$ language plpgsql;

create trigger track_version_changes
after insert or update or delete on vfs.file_versions
for each row execute procedure vfs.trigger_usage_on_versions();

-- 4. Trigger 2: Files (For Permanent Deletion)
-- Când ștergem un fișier, știm sigur space_id-ul din OLD record.
create or replace function vfs.trigger_usage_on_files()
returns trigger as $$
begin
  -- La ștergere, fișierul dispare, deci suma va scădea.
  -- Recalculăm pentru space-ul care a deținut fișierul.
  if (TG_OP = 'DELETE') then
      perform vfs.recalc_space_usage(OLD.space_id);
  end if;
  return null;
end;
$$ language plpgsql;

create trigger track_file_deletion
after delete on vfs.files
for each row execute procedure vfs.trigger_usage_on_files();
