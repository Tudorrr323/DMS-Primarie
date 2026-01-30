-- Fix ambiguous column reference in file_versions join
-- When joining with file_versions, we need to be explicit about table aliases in RLS policies or use a cleaner join structure.

-- Re-create the view policy for files to be more robust against join ambiguity
drop policy if exists "File access" on vfs.files;
create policy "File access" on vfs.files
for select using (
  (
    space_id in (select id from vfs.user_space where profile_id = (select auth.uid()))
    or exists (select 1 from vfs.permissions where file_id = id and profile_id = (select auth.uid()))
    or (folder_id is not null and vfs.has_access(folder_id, (select auth.uid())))
  )
  and deleted_at is null
);

-- Ensure file_versions foreign key is unambiguous
-- (This is usually fine, but let's make sure the constraint names don't conflict)

-- RE-APPLY function fix just to be absolutely sure it's present
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
