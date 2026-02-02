import { supabase } from '../../../../../lib/supabase';
import { handleVFSError } from '../errors';

/**
 * Searches for folders and files by name across the entire drive.
 * @param {string} query The search string
 */
export async function searchItems(query) {
  if (!query || query.trim().length === 0) return [];

  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Utilizatorul nu este autentificat.");

    const searchTerm = `%${query}%`;

    // 1. Search Folders
    const folderQuery = supabase
      .schema('vfs')
      .from('folders')
      .select('id, name, created_at, parent_id, deleted_at')
      .ilike('name', searchTerm)
      .is('deleted_at', null)
      .limit(20);

    // 2. Search Files
    const fileQuery = supabase
      .schema('vfs')
      .from('files')
      .select('id, name, created_at, mime_type, folder_id, deleted_at, file_versions(size)')
      .ilike('name', searchTerm)
      .is('deleted_at', null)
      .limit(20);

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
          deleted_at: f.deleted_at
        });
      });
    }

    // Map Files
    if (filesRes.data) {
      filesRes.data.forEach((f) => {
        const versions = f.file_versions || f['vfs.file_versions'] || f.versions;
        const size = versions?.[0]?.size || 0; 
        
        items.push({
          id: f.id,
          type: 'file',
          name: f.name,
          parent_id: f.folder_id,
          mime_type: f.mime_type,
          size: size,
          created_at: f.created_at,
          deleted_at: f.deleted_at
        });
      });
    }

    return items;
  } catch (error) {
    throw handleVFSError(error, "Eroare la căutare.");
  }
}
