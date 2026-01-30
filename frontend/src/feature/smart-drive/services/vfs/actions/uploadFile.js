import { supabase } from '../../../../../lib/supabase';
import { handleVFSError } from '../errors';
import { getUserSpace } from './getUserSpace';

const BUCKET_NAME = 'vfs-bucket';

/**
 * Uploads a file (Metadata + Storage).
 */
export async function uploadFile(file, parentId, onProgress) {
  try {
    const space = await getUserSpace();
    if (!space) throw new Error("Spațiul de stocare al utilizatorului nu a fost găsit.");

    // 1. Create File Metadata
    const fileResponse = await supabase
      .schema('vfs')
      .from('files')
      .insert({
        space_id: space.id,
        folder_id: parentId,
        name: file.name,
        mime_type: file.type
      })
      .select()
      .single();

    if (fileResponse.error) throw fileResponse.error;
    const vfsFile = fileResponse.data;

    // 2. Upload to Storage Bucket
    const versionNumber = 1;
    const storagePath = `${space.id}/${vfsFile.id}_v${versionNumber}`; 

    const storageResponse = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (storageResponse.error) {
      // Rollback metadata if storage fails
      await supabase.schema('vfs').from('files').delete().eq('id', vfsFile.id);
      throw storageResponse.error;
    }

    // 3. Create Version Entry
    const versionResponse = await supabase
      .schema('vfs')
      .from('file_versions')
      .insert({
        file_id: vfsFile.id,
        storage_path: storagePath,
        size: file.size,
        version_number: versionNumber
      });

    if (versionResponse.error) throw versionResponse.error;

    return vfsFile;
  } catch (error) {
    throw handleVFSError(error, "Nu s-a putut încărca fișierul.");
  }
}
