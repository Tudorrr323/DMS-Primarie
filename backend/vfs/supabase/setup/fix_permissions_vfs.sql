-- Grant usage on schema vfs to authenticated roles
GRANT USAGE ON SCHEMA vfs TO postgres, anon, authenticated, service_role;

-- Grant access to all tables in vfs schema
GRANT ALL ON ALL TABLES IN SCHEMA vfs TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA vfs TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA vfs TO postgres, anon, authenticated, service_role;

-- Allow users to insert their own user_space (Self-healing/Auto-creation)
create policy "Insert own space" on vfs.user_space
for insert with check (profile_id = auth.uid());

-- Fix infinite recursion in has_access
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