import { supabase } from '../../../../../lib/supabase';
import { handleVFSError } from '../errors';

const BUCKET_NAME = 'vfs-bucket';

/**
 * Generates a signed URL for downloading/viewing a file.
 */
export async function getFileUrl(fileId) {
  try {
    // 1. Get the latest version path
    const versionResponse = await supabase
      .schema('vfs')
      .from('file_versions')
      .select('storage_path')
      .eq('file_id', fileId)
      .order('version_number', { ascending: false })
      .limit(1);

    if (versionResponse.error) throw versionResponse.error;
    
    const versions = versionResponse.data;
    if (!versions || versions.length === 0) throw new Error("Nu s-a găsit nicio versiune a fișierului.");

    const path = versions[0].storage_path;

    // 2. Generate Signed URL (valid for 1 hour)
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, 3600); 

    if (error) throw error;
    if (!data.signedUrl) throw new Error("Nu s-a putut genera URL-ul.");

    return data.signedUrl;
  } catch (error) {
    throw handleVFSError(error, "Nu s-a putut genera link-ul de descărcare.");
  }
}
