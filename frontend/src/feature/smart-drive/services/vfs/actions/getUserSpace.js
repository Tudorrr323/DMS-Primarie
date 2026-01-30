import { supabase } from '../../../../../lib/supabase';
import { handleVFSError } from '../errors';

/**
 * Initializes or retrieves the user's space.
 * @returns UserSpace object or null if failed/not found.
 */
export async function getUserSpace() {
  try {
    const response = await supabase
      .schema('vfs')
      .from('user_space')
      .select('*')
      .single();
      
    if (response.error) throw response.error;
    return response.data;
  } catch (err) {
    // We do not throw here to allow 'null' checks in UI initialization
    console.warn("getUserSpace failed:", err);
    return null;
  }
}
