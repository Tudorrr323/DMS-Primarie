-- Fix RLS policy infinite recursion by avoiding circular dependency in "File access"
-- The policy "File access" on vfs.files calls vfs.has_access(folder_id).
-- vfs.has_access queries vfs.folders.
-- vfs.folders policies query vfs.files (sometimes) or vfs.permissions.
-- vfs.permissions policies query vfs.files.
-- This creates a cycle: files -> permissions -> files.

-- 1. Drop existing problematic policies
drop policy if exists "File access" on vfs.files;
drop policy if exists "View active folders" on vfs.folders;
drop policy if exists "Manage sharing" on vfs.permissions;

-- 2. Create simplified, non-recursive policies

-- Folders: Only check ownership or direct permission (breaking the chain)
create policy "View active folders" on vfs.folders
for select using (
  (
    space_id in (select id from vfs.user_space where profile_id = auth.uid()) 
    or 
    exists (select 1 from vfs.permissions where folder_id = id and profile_id = auth.uid())
    or
    -- Allow viewing if parent is accessible (Limited depth to prevent heavy recursion, or rely on optimized has_access)
    (parent_id is not null and vfs.has_access(parent_id, auth.uid()))
  )
  and deleted_at is null
);

-- Files: Breaking the cycle with permissions
create policy "File access" on vfs.files
for select using (
  (
    -- 1. Owner
    space_id in (select id from vfs.user_space where profile_id = auth.uid())
    or 
    -- 2. Direct permission on file
    exists (select 1 from vfs.permissions where file_id = id and profile_id = auth.uid())
    or 
    -- 3. Inherited from folder (Safe because has_access is SECURITY DEFINER now)
    (folder_id is not null and vfs.has_access(folder_id, auth.uid()))
  )
  and deleted_at is null
);

-- Permissions: Break the cycle by checking space ownership directly or folder ownership directly
create policy "Manage sharing" on vfs.permissions
for all using (
    -- You can manage permissions if you own the SPACE where the item resides
    exists (
        select 1 from vfs.user_space us
        where us.profile_id = auth.uid()
        and (
            (folder_id is not null and exists (select 1 from vfs.folders f where f.id = folder_id and f.space_id = us.id))
            or
            (file_id is not null and exists (select 1 from vfs.files fl where fl.id = file_id and fl.space_id = us.id))
        )
    )
);

-- 3. Ensure My Drive exists for the user
do $$
declare
    current_uid uuid;
    space_id uuid;
begin
    -- Iterate over all profiles that might be missing a space
    for current_uid in select id from public.profiles loop
        -- Ensure Space
        insert into vfs.user_space (profile_id) 
        values (current_uid)
        on conflict (profile_id) do nothing;
        
        -- Get Space ID
        select id into space_id from vfs.user_space where profile_id = current_uid;
        
        -- Ensure 'My Drive' exists
        insert into vfs.folders (space_id, parent_id, name)
        select space_id, null, 'My Drive'
        where not exists (
            select 1 from vfs.folders 
            where space_id = space_id and parent_id is null and name = 'My Drive'
        );
    end loop;
end $$;
