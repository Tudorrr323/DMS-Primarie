// Definirea tipurilor de bază pentru Smart Drive (Schema VFS)

/**
 * Reprezintă un Folder din sistem (tabela vfs.folders)
 */
export type Folder = {
  id: string;
  space_id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
  deleted_at: string | null;
};

/**
 * Reprezintă un Fișier din sistem (tabela vfs.files)
 */
export type FileItem = {
  id: string;
  space_id: string;
  folder_id: string | null;
  name: string;
  mime_type: string | null;
  created_at: string;
  deleted_at: string | null;
  size?: number; // Calculat din versiuni
};

/**
 * Un tip uniune pentru a lucra generic cu elemente
 */
export type DriveItem = 
  | (Folder & { type: 'folder' }) 
  | (FileItem & { type: 'file' });

export type FileVersion = {
  id: string;
  file_id: string;
  storage_path: string;
  size: number;
  version_number: number;
  created_at: string;
};

export const FileTypeIcons: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'image',
  'image/png': 'image',
  'folder': 'folder'
};