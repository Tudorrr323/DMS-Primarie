-- VFS Full Database Dump (Schema + Tables + Logic)
-- Generated on 2026-01-30
-- Includes fixes for RLS Recursion, Audit Triggers, and Ambiguity.

-- Enable the UUID extension if not already enabled
create extension if not exists "pgcrypto";

-- 1. Setup Schema
create schema if not exists vfs;

-- 2. Global Configurations: Data Types
do $$ 
begin
    if not exists (select 1 from pg_type where typname = 'access_level' and typnamespace = 'vfs'::regnamespace) then
        create type vfs.access_level as enum ('viewer', 'editor');
    end if;
    if not exists (select 1 from pg_type where typname = 'audit_entity_type' and typnamespace = 'vfs'::regnamespace) then
        create type vfs.audit_entity_type as enum ('folder', 'file', 'permission', 'space');
    end if;
    if not exists (select 1 from pg_type where typname = 'audit_action_type' and typnamespace = 'vfs'::regnamespace) then
        create type vfs.audit_action_type as enum ('CREATE', 'UPDATE', 'DELETE', 'MOVE', 'SHARE', 'RESTORE');
    end if;
end $$;

-- 3. Tables

-- User Space
create table if not exists vfs.user_space (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  storage_limit bigint not null default 524288000, -- 500MB Limit
  storage_used bigint not null default 0,
  created_at timestamp with time zone default now()
);

create index if not exists idx_user_space_profile_id on vfs.user_space(profile_id);

-- Folders
create table if not exists vfs.folders (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references vfs.user_space(id) on delete cascade,
  parent_id uuid references vfs.folders(id) on delete cascade,
  name text not null,
  created_at timestamp with time zone default now(),
  deleted_at timestamp with time zone default null,

  constraint folder_name_unique_in_space unique nulls not distinct (space_id, parent_id, name)
);

create index if not exists idx_folders_parent_id on vfs.folders(parent_id);
create index if not exists idx_folders_deleted_at on vfs.folders(deleted_at) where deleted_at is not null;

-- Files
create table if not exists vfs.files (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references vfs.user_space(id) on delete cascade,
  folder_id uuid references vfs.folders(id) on delete cascade,
  name text not null,
  mime_type text,
  created_at timestamp with time zone default now(),
  deleted_at timestamp with time zone default null,

  constraint file_name_unique_in_folder unique nulls not distinct (space_id, folder_id, name)
);

create index if not exists idx_files_deleted_at on vfs.files(deleted_at) where deleted_at is not null;

-- File Versions
create table if not exists vfs.file_versions (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references vfs.files(id) on delete cascade,
  storage_path text not null,
  size bigint not null,
  version_number int not null,
  created_at timestamp with time zone default now()
);

-- Permissions
create table if not exists vfs.permissions (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references vfs.folders(id) on delete cascade,
  file_id uuid references vfs.files(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  access_level vfs.access_level not null default 'viewer',
  
  constraint unique_user_perm_folder unique(folder_id, profile_id),
  constraint unique_user_perm_file unique(file_id, profile_id),
  constraint folder_or_file_check check ((folder_id is not null) or (file_id is not null))
);

-- Audit Log
create table if not exists vfs.audit_log (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references vfs.user_space(id) on delete cascade,
  profile_id uuid references public.profiles(id),
  
  entity_type vfs.audit_entity_type not null,
  entity_id uuid not null,
  action_type vfs.audit_action_type not null,
  
  old_data jsonb,
  new_data jsonb,
  
  created_at timestamp with time zone default now()
);

create index if not exists idx_audit_log_space_id on vfs.audit_log(space_id);
create index if not exists idx_audit_log_created_at on vfs.audit_log(created_at desc);

-- 4. RLS Enablement
alter table vfs.user_space enable row level security;
alter table vfs.folders enable row level security;
alter table vfs.files enable row level security;
alter table vfs.file_versions enable row level security;
alter table vfs.permissions enable row level security;

-- 5. Helper Functions (Ownership & Recursive Access)

create or replace function vfs.is_folder_owner(_folder_id uuid, _user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = vfs, public
as $$
begin
    return exists (
        select 1 
        from vfs.folders f
        join vfs.user_space us on f.space_id = us.id
        where f.id = _folder_id
        and us.profile_id = _user_id
    );
end;
$$;
alter function vfs.is_folder_owner(_folder_id uuid, _user_id uuid) owner to postgres;

create or replace function vfs.is_file_owner(_file_id uuid, _user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = vfs, public
as $$
begin
    return exists (
        select 1 
        from vfs.files f
        join vfs.user_space us on f.space_id = us.id
        where f.id = _file_id
        and us.profile_id = _user_id
    );
end;
$$;
alter function vfs.is_file_owner(_file_id uuid, _user_id uuid) owner to postgres;

create or replace function vfs.has_access(_folder_id uuid, _profile_id uuid)
returns boolean 
language plpgsql
security definer
set search_path = vfs, public
as $$
declare
    has_perm boolean;
begin
    with recursive folder_tree as (
        select id, parent_id
        from vfs.folders
        where id = _folder_id
        union all
        select f.id, f.parent_id
        from vfs.folders f
        join folder_tree ft on f.id = ft.parent_id
    )
    select exists (
        select 1
        from vfs.permissions p
        join folder_tree ft on p.folder_id = ft.id
        where p.profile_id = _profile_id
    ) into has_perm;

    return coalesce(has_perm, false);
end;
$$;
alter function vfs.has_access(_folder_id uuid, _profile_id uuid) owner to postgres;

-- 6. RLS Policies

-- User Space
create policy "Owner space visibility" on vfs.user_space
for select using (profile_id = (select auth.uid()));

create policy "Insert own space" on vfs.user_space
for insert with check (profile_id = (select auth.uid()));

-- Folders
create policy "View active folders" on vfs.folders
for select using (
  (
    space_id in (select id from vfs.user_space where profile_id = auth.uid()) 
    or 
    exists (
        select 1 from vfs.permissions p 
        where p.folder_id = vfs.folders.id 
        and p.profile_id = auth.uid()
    )
    or
    (parent_id is not null and vfs.has_access(parent_id, auth.uid()))
  )
  and deleted_at is null
);

create policy "View trash" on vfs.folders
for select using (
  space_id in (select id from vfs.user_space where profile_id = (select auth.uid()))
  and deleted_at is not null
);

create policy "Owner manage folders" on vfs.folders
for all using (
  space_id in (select id from vfs.user_space where profile_id = (select auth.uid()))
);

-- Files
create policy "File access" on vfs.files
for select using (
  (
    space_id in (select id from vfs.user_space where profile_id = auth.uid())
    or 
    exists (
        select 1 from vfs.permissions p 
        where p.file_id = vfs.files.id
        and p.profile_id = auth.uid()
    )
    or 
    (folder_id is not null and vfs.has_access(folder_id, auth.uid()))
  )
  and deleted_at is null
);

create policy "View trash files" on vfs.files
for select using (
  space_id in (select id from vfs.user_space where profile_id = (select auth.uid()))
  and deleted_at is not null
);

create policy "Owner manage files" on vfs.files
for all using (
  space_id in (select id from vfs.user_space where profile_id = (select auth.uid()))
);

-- Versions
create policy "Version access" on vfs.file_versions
for select using (exists (select 1 from vfs.files where id = file_id));

create policy "Owner manage versions" on vfs.file_versions
for all using (
    exists (select 1 from vfs.files where id = file_id and space_id in (select id from vfs.user_space where profile_id = (select auth.uid())))
);

-- Permissions
create policy "Read assigned permissions" on vfs.permissions
for select using (profile_id = auth.uid());

create policy "Owner manage permissions" on vfs.permissions
for all using (
    (folder_id is not null and vfs.is_folder_owner(folder_id, auth.uid()))
    or
    (file_id is not null and vfs.is_file_owner(file_id, auth.uid()))
);

-- 7. Business Logic Functions & Triggers

-- A. New User Setup
create or replace function vfs.handle_new_user_setup()
returns trigger as $$
declare
  new_space_id uuid;
begin
  insert into vfs.user_space (profile_id) values (new.id) returning id into new_space_id;
  insert into vfs.folders (space_id, parent_id, name) values (new_space_id, null, 'My Drive');
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_profile_created on public.profiles;
create trigger on_profile_created after insert on public.profiles
for each row execute procedure vfs.handle_new_user_setup();

-- B. Sync Storage Usage
create or replace function vfs.sync_storage_usage()
returns trigger as $$
begin
  update vfs.user_space set storage_used = (
    select coalesce(sum(v.size), 0)
    from vfs.file_versions v
    join vfs.files f on v.file_id = f.id
    where f.space_id = (select space_id from vfs.files where id = coalesce(new.file_id, old.file_id))
  ) where id = (select space_id from vfs.files where id = coalesce(new.file_id, old.file_id));
  return null;
end;
$$ language plpgsql;

drop trigger if exists on_version_change on vfs.file_versions;
create trigger on_version_change after insert or delete on vfs.file_versions
for each row execute procedure vfs.sync_storage_usage();

-- C. Audit Log Processing
create or replace function vfs.process_audit_log()
returns trigger as $$
declare
    current_user_id uuid := (select auth.uid());
    target_space_id uuid;
    final_action vfs.audit_action_type;
    final_entity vfs.audit_entity_type;
    old_payload jsonb;
    new_payload jsonb;
begin
    -- Determine Target Space ID safely
    if tg_table_name = 'permissions' then
        if tg_op = 'INSERT' or tg_op = 'UPDATE' then
             if new.folder_id is not null then
                select space_id into target_space_id from vfs.folders where id = new.folder_id;
             elsif new.file_id is not null then
                 select space_id into target_space_id from vfs.files where id = new.file_id;
             end if;
        end if;
        if target_space_id is null and (tg_op = 'DELETE' or tg_op = 'UPDATE') then
             if old.folder_id is not null then
                select space_id into target_space_id from vfs.folders where id = old.folder_id;
             elsif target_space_id is null and old.file_id is not null then
                 select space_id into target_space_id from vfs.files where id = old.file_id;
             end if;
        end if;
    else
        if tg_op = 'INSERT' or tg_op = 'UPDATE' then
           target_space_id := (to_jsonb(new)->>'space_id')::uuid;
        else
           target_space_id := (to_jsonb(old)->>'space_id')::uuid;
        end if;
    end if;

    -- Determine Action Type
    final_action := case 
        when tg_op = 'INSERT' then 'CREATE'::vfs.audit_action_type
        when tg_op = 'UPDATE' then 
            case 
                when (to_jsonb(old)->>'deleted_at') is not null and (to_jsonb(new)->>'deleted_at') is null then 'RESTORE'::vfs.audit_action_type
                when (to_jsonb(old)->>'deleted_at') is null and (to_jsonb(new)->>'deleted_at') is not null then 'DELETE'::vfs.audit_action_type
                when (to_jsonb(old)->>'parent_id') is distinct from (to_jsonb(new)->>'parent_id') then 'MOVE'::vfs.audit_action_type
                else 'UPDATE'::vfs.audit_action_type
            end
        when tg_op = 'DELETE' then 'DELETE'::vfs.audit_action_type
    end;

    final_entity := case 
        when tg_table_name = 'folders' then 'folder'::vfs.audit_entity_type
        when tg_table_name = 'files' then 'file'::vfs.audit_entity_type
        when tg_table_name = 'permissions' then 'permission'::vfs.audit_entity_type
    end;

    old_payload := case when tg_op != 'INSERT' then to_jsonb(old) else null end;
    new_payload := case when tg_op != 'DELETE' then to_jsonb(new) else null end;

    if target_space_id is not null then
        insert into vfs.audit_log (space_id, profile_id, entity_type, entity_id, action_type, old_data, new_data)
        values (target_space_id, current_user_id, final_entity, coalesce((new_payload->>'id')::uuid, (old_payload->>'id')::uuid), final_action, old_payload, new_payload);
    end if;
    return null;
end;
$$ language plpgsql security definer;

drop trigger if exists audit_folders on vfs.folders;
create trigger audit_folders after insert or update or delete on vfs.folders
for each row execute procedure vfs.process_audit_log();

drop trigger if exists audit_files on vfs.files;
create trigger audit_files after insert or update or delete on vfs.files
for each row execute procedure vfs.process_audit_log();

drop trigger if exists audit_permissions on vfs.permissions;
create trigger audit_permissions after insert or update or delete on vfs.permissions
for each row execute procedure vfs.process_audit_log();

-- 8. Maintenance Functions

create or replace function vfs.cleanup_trash()
returns void security definer as $$
begin
  delete from vfs.folders where deleted_at < (now() - interval '30 days');
  delete from vfs.files where deleted_at < (now() - interval '30 days');
end;
$$ language plpgsql;

create or replace function vfs.restore_item(item_id uuid, is_folder boolean)
returns void as $$
begin
  if is_folder then
    update vfs.folders set deleted_at = null where id = item_id;
  else
    update vfs.files set deleted_at = null where id = item_id;
  end if;
end;
$$ language plpgsql;

create or replace function vfs.cleanup_useless_versions(days_to_keep int default 30)
returns void security definer as $$
begin
  delete from vfs.file_versions v
  where v.created_at < (now() - (days_to_keep || ' days')::interval)
    and v.version_number < (select max(version_number) from vfs.file_versions where file_id = v.file_id);
end;
$$ language plpgsql;

-- 9. Storage Setup (Bucket & Policies)

insert into storage.buckets (id, name, public)
values ('vfs-bucket', 'vfs-bucket', false)
on conflict (id) do nothing;

create policy "VFS Access" on storage.objects
for select using (
  bucket_id = 'vfs-bucket' 
  and exists (
    select 1 from vfs.file_versions fv
    join vfs.files f on fv.file_id = f.id
    where fv.storage_path = storage.objects.name
    and (
       f.space_id in (select id from vfs.user_space where profile_id = auth.uid())
       or exists (select 1 from vfs.permissions p where p.file_id = f.id and p.profile_id = auth.uid())
       or (f.folder_id is not null and vfs.has_access(f.folder_id, auth.uid()))
    )
  )
);

create policy "VFS Upload" on storage.objects
for insert with check (
  bucket_id = 'vfs-bucket'
  and (
     exists (
        select 1 from vfs.user_space 
        where id::text = split_part(storage.objects.name, '/', 1)
        and profile_id = (select auth.uid())
     )
  )
);

create policy "VFS Delete" on storage.objects
for delete using (
  bucket_id = 'vfs-bucket'
  and (
     exists (
        select 1 from vfs.user_space 
        where id::text = split_part(storage.objects.name, '/', 1)
        and profile_id = (select auth.uid())
     )
  )
);

-- 10. Permissions & Grants

GRANT USAGE ON SCHEMA vfs TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA vfs TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA vfs TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA vfs TO postgres, anon, authenticated, service_role;

grant execute on function vfs.has_access to postgres, authenticated, service_role;
grant execute on function vfs.is_folder_owner to postgres, authenticated, service_role;
grant execute on function vfs.is_file_owner to postgres, authenticated, service_role;
