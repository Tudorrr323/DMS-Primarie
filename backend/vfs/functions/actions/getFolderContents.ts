import { supabase } from '../../../../frontend/src/lib/supabase';
import { handleVFSError } from '../errors';
import { VFSItem } from '../types';

/**
 * Fetches contents of a folder (files and subfolders).
 * @param folderId null for Root (My Drive)
 */
export async function getFolderContents(folderId: string | null): Promise<VFSItem[]> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Utilizatorul nu este autentificat.");

    // 1. Prepare Queries
    let folderQuery = supabase
      .schema('vfs')
      .from('folders')
      .select('id, name, created_at, parent_id, deleted_at')
      .is('deleted_at', null)
      .order('name');

    let fileQuery = supabase
      .schema('vfs')
      .from('files')
      .select('id, name, created_at, mime_type, folder_id, deleted_at, file_versions(size)')
      .is('deleted_at', null)
      .order('name');

    // 2. Apply Filters
    if (folderId) {
      folderQuery = folderQuery.eq('parent_id', folderId);
      fileQuery = fileQuery.eq('folder_id', folderId);
    } else {
      // Root View: parent_id IS NULL
      folderQuery = folderQuery.is('parent_id', null);
      fileQuery = fileQuery.is('folder_id', null);
    }

    // 3. Execute Parallel
    const [foldersRes, filesRes] = await Promise.all([folderQuery, fileQuery]);

    if (foldersRes.error) throw foldersRes.error;
    if (filesRes.error) throw filesRes.error;

    const items: VFSItem[] = [];

    // 4. Map Folders
    const folders = foldersRes.data as any[];
    if (folders) {
      folders.forEach((f: any) => {
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

    // 5. Map Files
    const files = filesRes.data as any[];
    if (files) {
      files.forEach((f: any) => {
        // Handle potential response structure variations
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
    throw handleVFSError(error, "Nu s-a putut încărca conținutul folderului.");
  }
}
