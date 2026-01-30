import { supabase } from '../../../../../lib/supabase';
import { handleVFSError } from '../errors';

/**
 * Fetches items from the trash.
 */
export async function getTrashItems() {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Utilizatorul nu este autentificat.");

    // 1. Prepare Queries (Deleted Items)
    // Note: We look for items where deleted_at IS NOT NULL
    // And belong to the user (owned space)
    
    let folderQuery = supabase
      .schema('vfs')
      .from('folders')
      .select('id, name, created_at, parent_id, deleted_at')
      .not('deleted_at', 'is', null)
      .eq('space_id', (await getUserSpaceId())); 

    let fileQuery = supabase
      .schema('vfs')
      .from('files')
      .select('id, name, created_at, mime_type, folder_id, deleted_at, file_versions(size)')
      .not('deleted_at', 'is', null)
      .eq('space_id', (await getUserSpaceId()));

    const [foldersRes, filesRes] = await Promise.all([folderQuery, fileQuery]);

    if (foldersRes.error) throw foldersRes.error;
    if (filesRes.error) throw filesRes.error;

    const items = [];

    // Map Folders
    if (foldersRes.data) {
      foldersRes.data.forEach((f) => {
        items.push({
          id: f.id,
          type: 'folder',
          name: f.name,
          parent_id: f.parent_id,
          created_at: f.created_at,
          deleted_at: f.deleted_at,
          is_in_trash: true
        });
      });
    }

    // Map Files
    if (filesRes.data) {
      filesRes.data.forEach((f) => {
        const versions = f.file_versions || [];
        const size = versions?.[0]?.size || 0; 
        
        items.push({
          id: f.id,
          type: 'file',
          name: f.name,
          parent_id: f.folder_id,
          mime_type: f.mime_type,
          size: size,
          created_at: f.created_at,
          deleted_at: f.deleted_at,
          is_in_trash: true
        });
      });
    }

    return items;
  } catch (error) {
    throw handleVFSError(error, "Nu s-a putut încărca coșul de gunoi.");
  }
}

// Helper to get space id quickly
async function getUserSpaceId() {
    const { data } = await supabase.schema('vfs').from('user_space').select('id').single();
    return data?.id;
}
