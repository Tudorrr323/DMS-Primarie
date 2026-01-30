import { supabase } from '../../../../../lib/supabase';
import { handleVFSError } from '../errors';

/**
 * Fetches permissions for a specific folder or file.
 */
export async function getPermissions(itemId, itemType) {
  try {
    const column = itemType === 'folder' ? 'folder_id' : 'file_id';
    
    const response = await supabase
      .schema('vfs')
      .from('permissions')
      .select(`
        id, 
        folder_id, 
        file_id, 
        profile_id, 
        access_level,
        user:profile_id (
            email
        )
      `)
      .eq(column, itemId);

    if (response.error) throw response.error;
    
    const permissions = response.data.map(p => ({
      id: p.id,
      folder_id: p.folder_id,
      file_id: p.file_id,
      profile_id: p.profile_id,
      access_level: p.access_level,
      user: Array.isArray(p.user) ? p.user[0] : p.user
    }));

    return permissions;
  } catch (error) {
    throw handleVFSError(error, "Nu s-au putut încărca permisiunile.");
  }
}

/**
 * Grants or updates permission for a user.
 */
export async function grantPermission(itemId, itemType, targetUserId, level) {
  try {
    const payload = {
      profile_id: targetUserId,
      access_level: level
    };

    if (itemType === 'folder') payload.folder_id = itemId;
    else payload.file_id = itemId;

    const response = await supabase
      .schema('vfs')
      .from('permissions')
      .upsert(payload, { onConflict: itemType === 'folder' ? 'folder_id, profile_id' : 'file_id, profile_id' })
      .select()
      .single();

    if (response.error) throw response.error;
    return response.data;
  } catch (error) {
    throw handleVFSError(error, "Nu s-a putut acorda permisiunea.");
  }
}

/**
 * Revokes permission for a user.
 */
export async function revokePermission(permissionId) {
  try {
    const { error } = await supabase
      .schema('vfs')
      .from('permissions')
      .delete()
      .eq('id', permissionId);

    if (error) throw error;
  } catch (error) {
    throw handleVFSError(error, "Nu s-a putut revoca permisiunea.");
  }
}
