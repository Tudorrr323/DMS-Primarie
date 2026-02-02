import { supabase } from '../../../../../lib/supabase';
import { handleVFSError } from '../errors';

/**
 * Copies a file or folder to a new location.
 * For folders, it does a shallow copy of the folder itself. 
 * Recursive copy would require a more complex implementation or a database function.
 * For now, we implement file copy and basic folder copy.
 */
export async function copyItem(id, type, targetFolderId) {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Utilizatorul nu este autentificat.");

    if (type === 'file') {
      // 1. Get source file details
      const { data: file, error: fileError } = await supabase
        .schema('vfs')
        .from('files')
        .select('*, file_versions(*)')
        .eq('id', id)
        .single();

      if (fileError) throw fileError;

      // 2. Create new file entry
      const { data: newFile, error: newFileError } = await supabase
        .schema('vfs')
        .from('files')
        .insert({
          space_id: file.space_id,
          folder_id: targetFolderId,
          name: `Copy of ${file.name}`,
          mime_type: file.mime_type
        })
        .select()
        .single();

      if (newFileError) throw newFileError;

      // 3. Create new version entry (pointing to the same storage path)
      const latestVersion = file.file_versions.sort((a, b) => b.version_number - a.version_number)[0];
      if (latestVersion) {
        const { error: versionError } = await supabase
          .schema('vfs')
          .from('file_versions')
          .insert({
            file_id: newFile.id,
            storage_path: latestVersion.storage_path,
            size: latestVersion.size,
            version_number: 1
          });
        
        if (versionError) throw versionError;
      }

      return newFile;
    } else {
      // Folder Copy (Shallow for now to keep it safe and fast)
      const { data: folder, error: folderError } = await supabase
        .schema('vfs')
        .from('folders')
        .select('*')
        .eq('id', id)
        .single();

      if (folderError) throw folderError;

      const { data: newFolder, error: newFolderError } = await supabase
        .schema('vfs')
        .from('folders')
        .insert({
          space_id: folder.space_id,
          parent_id: targetFolderId,
          name: `Copy of ${folder.name}`
        })
        .select()
        .single();

      if (newFolderError) throw newFolderError;
      
      // Note: Recursive copy of children is not implemented here 
      // as it would require many API calls or a recursive RPC.
      return newFolder;
    }
  } catch (error) {
    throw handleVFSError(error, "Nu s-a putut copia elementul.");
  }
}
