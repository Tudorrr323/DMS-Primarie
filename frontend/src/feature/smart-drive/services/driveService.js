import * as vfs from './vfs';

/**
 * Service Wrapper pentru VFS.
 * Mapează funcțiile modulare VFS la interfața așteptată de useDriveStore.
 */
export const driveService = {
  // 1. Spațiu & Conținut
  getUserSpace: vfs.getUserSpace,
  getFolderContents: (spaceId, folderId) => vfs.getFolderContents(folderId),
  getSharedWithMe: vfs.getSharedWithMe,
  getTrashItems: vfs.getTrashItems,
  getFolderDetails: async (folderId) => {
      // getBreadcrumbs returnează tot lanțul, noi luăm doar ultimul element pentru detalii curente
      // sau folosim getBreadcrumbs pentru navigare completă
      const crumbs = await vfs.getBreadcrumbs(folderId);
      return crumbs[crumbs.length - 1]; // Returnăm folderul curent
  },

  // 2. Acțiuni Creare
  createFolder: (spaceId, parentId, name) => vfs.createFolder(name, parentId),
  uploadFile: (file, spaceId, parentId) => vfs.uploadFile(file, parentId),

  // 3. Acțiuni Fișiere
  getFileUrl: vfs.getFileUrl,
  deleteItem: vfs.moveToTrash,
  restoreItem: vfs.restoreFromTrash,
  deletePermanently: vfs.deletePermanently,
  renameItem: vfs.renameItem,
  moveItem: vfs.moveItem,

  // 4. Navigare & Permisiuni
  getBreadcrumbs: vfs.getBreadcrumbs,
  getPermissions: vfs.getPermissions,
  grantPermission: vfs.grantPermission,
  revokePermission: vfs.revokePermission
};
