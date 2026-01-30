import { SupabaseClient } from '@supabase/supabase-js';
// Adjust the import path to match your project structure where the supabase client is initialized
import { supabase } from '../../../frontend/src/lib/supabase'; 
import { handleVFSError } from './errors';
import { 
  Folder, 
  VFSFile, 
  VFSItem, 
  UserSpace, 
  Breadcrumb 
} from './types';

const BUCKET_NAME = 'vfs-bucket';

export class VFSService {
  private client: SupabaseClient;

  constructor(client: SupabaseClient = supabase) {
    this.client = client;
  }

  /**
   * Initializes the user's space if it doesn't exist.
   */
  async getUserSpace(): Promise<UserSpace | null> {
    try {
      // Use 'any' cast to bypass strict typing on the generic client response
      const response = await this.client
        .from('vfs.user_space')
        .select('*')
        .single();
        
      if (response.error) throw response.error;
      return response.data as UserSpace;
    } catch (err) {
      return null;
    }
  }

  /**
   * Fetches contents of a folder (files and subfolders).
   * @param folderId null for Root
   */
  async getFolderContents(folderId: string | null): Promise<VFSItem[]> {
    try {
      const { data: user } = await this.client.auth.getUser();
      if (!user.user) throw new Error("User not authenticated");

      let folderQuery = this.client
        .from('vfs.folders')
        .select('id, name, created_at, parent_id, deleted_at')
        .is('deleted_at', null)
        .order('name');

      let fileQuery = this.client
        .from('vfs.files')
        .select('id, name, created_at, mime_type, folder_id, deleted_at, vfs.file_versions(size)')
        .is('deleted_at', null)
        .order('name');

      if (folderId) {
        folderQuery = folderQuery.eq('parent_id', folderId);
        fileQuery = fileQuery.eq('folder_id', folderId);
      } else {
        folderQuery = folderQuery.is('parent_id', null);
        fileQuery = fileQuery.is('folder_id', null);
      }

      const [foldersRes, filesRes] = await Promise.all([folderQuery, fileQuery]);

      if (foldersRes.error) throw foldersRes.error;
      if (filesRes.error) throw filesRes.error;

      const items: VFSItem[] = [];

      // Explicitly cast to any[] to avoid implicit any errors during iteration
      const folders = foldersRes.data as any[];
      if (folders) {
        folders.forEach((f: any) => {
          items.push({
            id: f.id,
            type: 'folder',
            name: f.name,
            parent_id: f.parent_id,
            created_at: f.created_at,
            deleted_at: f.deleted_at
          });
        });
      }

      const files = filesRes.data as any[];
      if (files) {
        files.forEach((f: any) => {
          const size = f['vfs.file_versions']?.[0]?.size || 0; 
          
          items.push({
            id: f.id,
            type: 'file',
            name: f.name,
            parent_id: f.folder_id,
            mime_type: f.mime_type,
            size: size,
            created_at: f.created_at,
            deleted_at: f.deleted_at
          });
        });
      }

      return items;
    } catch (error) {
      throw handleVFSError(error, "Nu s-a putut încărca conținutul folderului.");
    }
  }

  /**
   * Creates a new folder.
   */
  async createFolder(name: string, parentId: string | null): Promise<Folder> {
    try {
      const space = await this.getUserSpace();
      if (!space) throw new Error("User Space not found");

      const response = await this.client
        .from('vfs.folders')
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

  /**
   * Uploads a file (Metadata + Storage).
   */
  async uploadFile(
    file: File, // Global DOM File object
    parentId: string | null, 
    onProgress?: (progress: number) => void
  ): Promise<VFSFile> {
    try {
      const space = await this.getUserSpace();
      if (!space) throw new Error("User Space not found");

      // 1. Create File Metadata
      const fileResponse = await this.client
        .from('vfs.files')
        .insert({
          space_id: space.id,
          folder_id: parentId,
          name: file.name,
          mime_type: file.type
        })
        .select()
        .single();

      if (fileResponse.error) throw fileResponse.error;
      const vfsFile = fileResponse.data as VFSFile;

      // 2. Upload to Storage Bucket
      const versionNumber = 1;
      const storagePath = `${space.id}/${vfsFile.id}_v${versionNumber}`; 

      const storageResponse = await this.client.storage
        .from(BUCKET_NAME)
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (storageResponse.error) {
        await this.client.from('vfs.files').delete().eq('id', vfsFile.id);
        throw storageResponse.error;
      }

      // 3. Create Version Entry
      const versionResponse = await this.client
        .from('vfs.file_versions')
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

  /**
   * Generates a signed URL for downloading/viewing a file.
   */
  async getFileUrl(fileId: string): Promise<string> {
    try {
      const versionResponse = await this.client
        .from('vfs.file_versions')
        .select('storage_path')
        .eq('file_id', fileId)
        .order('version_number', { ascending: false })
        .limit(1);

      if (versionResponse.error) throw versionResponse.error;
      const versions = versionResponse.data as any[];
      if (!versions || versions.length === 0) throw new Error("No version found");

      const path = versions[0].storage_path;

      const { data, error } = await this.client.storage
        .from(BUCKET_NAME)
        .createSignedUrl(path, 3600); 

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      throw handleVFSError(error, "Nu s-a putut genera link-ul de descărcare.");
    }
  }

  /**
   * Moves a folder or file to the Trash.
   */
  async moveToTrash(id: string, type: 'folder' | 'file'): Promise<void> {
    try {
      const table = type === 'folder' ? 'vfs.folders' : 'vfs.files';
      const { error } = await this.client
        .from(table)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      throw handleVFSError(error, "Nu s-a putut șterge elementul.");
    }
  }

  /**
   * Restores an item from Trash.
   */
  async restoreFromTrash(id: string, type: 'folder' | 'file'): Promise<void> {
    try {
      const { error } = await this.client.rpc('vfs.restore_item', { 
        item_id: id, 
        is_folder: type === 'folder' 
      });

      if (error) throw error;
    } catch (error) {
      throw handleVFSError(error, "Nu s-a putut restaura elementul.");
    }
  }

  /**
   * Renames a folder or file.
   */
  async renameItem(id: string, type: 'folder' | 'file', newName: string): Promise<void> {
    try {
      const table = type === 'folder' ? 'vfs.folders' : 'vfs.files';
      const { error } = await this.client
        .from(table)
        .update({ name: newName })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      throw handleVFSError(error, "Nu s-a putut redenumi elementul.");
    }
  }

  /**
   * Get breadcrumbs.
   */
  async getBreadcrumbs(folderId: string | null): Promise<Breadcrumb[]> {
    if (!folderId) return [{ id: 'root', name: 'My Drive' }];

    try {
      const crumbs: Breadcrumb[] = [];
      let currentId: string | null = folderId;

      while (currentId) {
        const response = await this.client
          .from('vfs.folders')
          .select('id, name, parent_id')
          .eq('id', currentId)
          .single();

        if (response.error || !response.data) break;
        
        const folder = response.data as Folder;
        crumbs.unshift({ id: folder.id, name: folder.name });
        currentId = folder.parent_id;
      }

      crumbs.unshift({ id: 'root', name: 'My Drive' });
      return crumbs;
    } catch (error) {
      console.warn("Failed to load breadcrumbs", error);
      return [{ id: 'root', name: 'My Drive' }];
    }
  }
}

export const vfsService = new VFSService();