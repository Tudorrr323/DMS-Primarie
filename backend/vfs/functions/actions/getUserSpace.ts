import { supabase } from '../../../../frontend/src/lib/supabase';
import { handleVFSError } from '../errors';
import { UserSpace } from '../types';

/**
 * Initializes or retrieves the user's space.
 * @returns UserSpace object or null if failed/not found.
 */
export async function getUserSpace(): Promise<UserSpace | null> {
  try {
    const response = await supabase
      .schema('vfs')
      .from('user_space')
      .select('*')
      .single();
      
    if (response.error) throw response.error;
    return response.data as UserSpace;
  } catch (err) {
    // We do not throw here to allow 'null' checks in UI initialization
    console.warn("getUserSpace failed:", err);
    return null;
  }
}
