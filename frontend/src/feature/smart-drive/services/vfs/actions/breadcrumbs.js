import { supabase } from '../../../../../lib/supabase';

/**
 * Generates breadcrumbs path from root to current folder.
 */
export async function getBreadcrumbs(folderId) {
  if (!folderId) return [{ id: 'root', name: 'My Drive' }];

  try {
    const crumbs = [];
    let currentId = folderId;

    // Traverse up (Limited to 10 levels to prevent infinite loops in client-side logic)
    let safetyCounter = 0;
    while (currentId && safetyCounter < 10) {
      const response = await supabase
        .schema('vfs')
        .from('folders')
        .select('id, name, parent_id')
        .eq('id', currentId)
        .single();

      if (response.error || !response.data) break;
      
      const folder = response.data;
      crumbs.unshift({ id: folder.id, name: folder.name });
      currentId = folder.parent_id;
      safetyCounter++;
    }

    crumbs.unshift({ id: 'root', name: 'My Drive' });
    return crumbs;
  } catch (error) {
    console.warn("Failed to load breadcrumbs", error);
    // Return at least root on failure
    return [{ id: 'root', name: 'My Drive' }];
  }
}
