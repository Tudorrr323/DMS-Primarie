export type AccessLevel = 'viewer' | 'editor';

export interface UserSpace {
  id: string;
  profile_id: string;
  storage_limit: number;
  storage_used: number;
  created_at: string;
}

export interface Folder {
  id: string;
  space_id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
  deleted_at: string | null;
}

export interface VFSFile {
  id: string;
  space_id: string;
  folder_id: string | null;
  name: string;
  mime_type: string;
  created_at: string;
  deleted_at: string | null;
  size?: number; // Often joined from versions
  updated_at?: string; // Often useful for UI
}

export interface FileVersion {
  id: string;
  file_id: string;
  storage_path: string;
  size: number;
  version_number: number;
  created_at: string;
}

export interface Permission {
  id: string;
  folder_id: string | null;
  file_id: string | null;
  profile_id: string;
  access_level: AccessLevel;
}

// Unified item for lists (File or Folder)
export interface VFSItem {
  id: string;
  type: 'folder' | 'file';
  name: string;
  parent_id: string | null;
  size?: number;
  mime_type?: string;
  created_at: string;
  updated_at?: string;
  deleted_at: string | null;
  access_level?: AccessLevel | 'owner'; // Calculated permission for current user
}

export interface Breadcrumb {
  id: string;
  name: string;
}