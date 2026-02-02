import { getUserSpace } from './vfs/actions/getUserSpace';
import { getFolderContents } from './vfs/actions/getFolderContents';
import { getSharedWithMe } from './vfs/actions/getSharedWithMe';
import { getTrashItems } from './vfs/actions/getTrashItems';
import { getBreadcrumbs } from './vfs/actions/breadcrumbs';
import { createFolder } from './vfs/actions/createFolder';
import { uploadFile } from './vfs/actions/uploadFile';
import { getFileUrl } from './vfs/actions/downloadFile';
import { moveToTrash, restoreFromTrash, deletePermanently } from './vfs/actions/trash';
import { renameItem, moveItem } from './vfs/actions/organize';
import { getPermissions, grantPermission, revokePermission } from './vfs/actions/permissions';
import { searchItems } from './vfs/actions/searchItems';
import { copyItem } from './vfs/actions/copyItem';

/**
 * Service Wrapper pentru VFS.
 * Mapează funcțiile modulare VFS la interfața așteptată de useDriveStore.
 */
export const driveService = {
  // 1. Spațiu & Conținut
  getUserSpace,
  getFolderContents: (spaceId, folderId) => getFolderContents(folderId),
  getSharedWithMe,
  getTrashItems,
  getFolderDetails: async (folderId) => {
      const crumbs = await getBreadcrumbs(folderId);
      return crumbs[crumbs.length - 1]; 
  },

  // 2. Acțiuni Creare
  createFolder: (spaceId, parentId, name) => createFolder(name, parentId),
  uploadFile: (file, spaceId, parentId) => uploadFile(file, parentId),

  // 3. Acțiuni Fișiere
  getFileUrl,
  deleteItem: moveToTrash,
  restoreItem: restoreFromTrash,
  deletePermanently,
  renameItem,
  moveItem,
  copyItem,

  // 4. Navigare & Permisiuni
  getBreadcrumbs,
  getPermissions,
  grantPermission,
  revokePermission,
  searchItems
};