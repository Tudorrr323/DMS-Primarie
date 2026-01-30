import { supabase } from '../../../../../lib/supabase';
import { handleVFSError } from '../errors';

/**
 * Fetches items shared with the current user.
 * Returns a list of VFSItems (folders and files).
 */
export async function getSharedWithMe() {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Utilizatorul nu este autentificat.");

    // Interogăm tabela de permisiuni pentru a găsi tot ce e partajat cu mine
    const { data: permissions, error } = await supabase
      .schema('vfs')
      .from('permissions')
      .select(`
        access_level,
        folder:vfs.folders (
            id, name, created_at, parent_id, deleted_at, space_id
        ),
        file:vfs.files (
            id, name, created_at, mime_type, folder_id, deleted_at, space_id,
            file_versions(size)
        )
      `)
      .eq('profile_id', user.user.id);

    if (error) throw error;

    const items = [];

    // Procesăm rezultatele pentru a le aduce la formatul VFSItem standard
    permissions.forEach((p) => {
        // Ignorăm elementele șterse sau inaccesibile (null)
        
        if (p.folder && !p.folder.deleted_at) {
            items.push({
                id: p.folder.id,
                type: 'folder',
                name: p.folder.name,
                parent_id: p.folder.parent_id,
                created_at: p.folder.created_at,
                access_level: p.access_level,
                is_shared: true,
                owner_space_id: p.folder.space_id
            });
        }

        if (p.file && !p.file.deleted_at) {
            // Calculăm mărimea
            const versions = p.file.file_versions || [];
            const size = versions?.[0]?.size || 0;

            items.push({
                id: p.file.id,
                type: 'file',
                name: p.file.name,
                parent_id: p.file.folder_id,
                mime_type: p.file.mime_type,
                size: size,
                created_at: p.file.created_at,
                access_level: p.access_level,
                is_shared: true,
                owner_space_id: p.file.space_id
            });
        }
    });

    return items;

  } catch (error) {
    throw handleVFSError(error, "Nu s-au putut încărca elementele partajate.");
  }
}
