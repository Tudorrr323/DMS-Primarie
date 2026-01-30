import { supabase } from '../../../../frontend/src/lib/supabase';
import { handleVFSError } from '../errors';
import { Folder } from '../types';
import { getUserSpace } from './getUserSpace';

/**
 * Creates a new folder.
 */
export async function createFolder(name: string, parentId: string | null): Promise<Folder> {
  try {
    const space = await getUserSpace();
    if (!space) throw new Error("Spațiul de stocare al utilizatorului nu a fost găsit.");

    const response = await supabase
      .schema('vfs')
      .from('folders')
      .insert({
        space_id: space.id,
        parent_id: parentId,
        name: name.trim()
      })
      .select()
      .single();

    if (response.error) throw response.error;
    return response.data as Folder;
  } catch (error) {
    throw handleVFSError(error, "Nu s-a putut crea folderul.");
  }
}
