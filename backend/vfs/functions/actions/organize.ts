import { supabase } from '../../../../frontend/src/lib/supabase';
import { handleVFSError } from '../errors';

/**
 * Renames a folder or file.
 */
export async function renameItem(id: string, type: 'folder' | 'file', newName: string): Promise<void> {
  try {
    const table = type === 'folder' ? 'folders' : 'files';
    const { error } = await supabase
      .schema('vfs')
      .from(table)
      .update({ name: newName.trim() })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    throw handleVFSError(error, "Nu s-a putut redenumi elementul.");
  }
}

/**
 * Moves an item to a different folder.
 */
export async function moveItem(id: string, type: 'folder' | 'file', newParentId: string | null): Promise<void> {
  try {
    const table = type === 'folder' ? 'folders' : 'files';
    const column = type === 'folder' ? 'parent_id' : 'folder_id';

    const { error } = await supabase
      .schema('vfs')
      .from(table)
      .update({ [column]: newParentId })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    throw handleVFSError(error, "Nu s-a putut muta elementul.");
  }
}
