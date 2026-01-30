-- Grant usage on schema vfs to authenticated roles
GRANT USAGE ON SCHEMA vfs TO postgres, anon, authenticated, service_role;

-- Grant access to all tables in vfs schema
GRANT ALL ON ALL TABLES IN SCHEMA vfs TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA vfs TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA vfs TO postgres, anon, authenticated, service_role;

-- Allow users to insert their own user_space (Self-healing/Auto-creation)
create policy "Insert own space" on vfs.user_space
for insert with check (profile_id = auth.uid());
