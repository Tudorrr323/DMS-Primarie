import { supabase } from '../../../../../lib/supabase';
import { handleVFSError } from '../errors';
import { getUserSpace } from './getUserSpace';

/**
 * Creates a new folder.
 */
export async function createFolder(name, parentId) {
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
    return response.data;
  } catch (error) {
    throw handleVFSError(error, "Nu s-a putut crea folderul.");
  }
}
