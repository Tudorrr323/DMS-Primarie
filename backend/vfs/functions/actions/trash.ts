import { supabase } from '../../../../frontend/src/lib/supabase';
import { handleVFSError } from '../errors';

/**
 * Moves a folder or file to the Trash.
 */
export async function moveToTrash(id: string, type: 'folder' | 'file'): Promise<void> {
  try {
    const table = type === 'folder' ? 'folders' : 'files';
    const { error } = await supabase
      .schema('vfs')
      .from(table)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    throw handleVFSError(error, "Nu s-a putut muta elementul la coșul de gunoi.");
  }
}

/**
 * Restores an item from Trash.
 */
export async function restoreFromTrash(id: string, type: 'folder' | 'file'): Promise<void> {
  try {
    // Uses the custom RPC to ensure safety
    const { error } = await supabase.rpc('vfs.restore_item', { 
      item_id: id, 
      is_folder: type === 'folder' 
    });

    if (error) throw error;
  } catch (error) {
    throw handleVFSError(error, "Nu s-a putut restaura elementul.");
  }
}

/**
 * Permanently deletes an item.
 * WARNING: This cannot be undone.
 */
export async function deletePermanently(id: string, type: 'folder' | 'file'): Promise<void> {
  try {
    const table = type === 'folder' ? 'folders' : 'files';
    const { error } = await supabase
      .schema('vfs')
      .from(table)
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    throw handleVFSError(error, "Nu s-a putut șterge definitiv elementul.");
  }
}
