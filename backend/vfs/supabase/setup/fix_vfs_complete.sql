-- VFS Complete Fix (RLS Recursion + Audit Trigger)
-- Generated on 2026-01-30

-- PART 1: Helper Functions for Ownership (Breaking Dependency Cycles)
-- These allow checking ownership without triggering RLS on the main tables

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

-- PART 2: Recursive Access Check (Optimization & Security)

drop function if exists vfs.has_access(_folder_id uuid, _profile_id uuid);

create or replace function vfs.has_access(_folder_id uuid, _profile_id uuid)
returns boolean 
language plpgsql
security definer -- EXECUTE AS OWNER (Postgres) to BYPASS RLS
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

-- PART 3: Permissions Table Policies

drop policy if exists "Manage sharing" on vfs.permissions;
drop policy if exists "Read own permissions" on vfs.permissions;

create policy "Read assigned permissions" on vfs.permissions
for select using (profile_id = auth.uid());

create policy "Owner manage permissions" on vfs.permissions
for all using (
    (folder_id is not null and vfs.is_folder_owner(folder_id, auth.uid()))
    or
    (file_id is not null and vfs.is_file_owner(file_id, auth.uid()))
);

-- PART 4: Main Table Policies (Ambiguity & Recursion Fix)

drop policy if exists "View active folders" on vfs.folders;
drop policy if exists "File access" on vfs.files;

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

-- PART 5: Audit Log Trigger Fix (Missing Column Handling)

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
             elsif old.file_id is not null then
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

-- Final Grants
grant execute on function vfs.has_access to postgres, authenticated, service_role;
grant execute on function vfs.is_folder_owner to postgres, authenticated, service_role;
grant execute on function vfs.is_file_owner to postgres, authenticated, service_role;
