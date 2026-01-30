import { create } from 'zustand';
import { driveService } from '../services/driveService';

const VIRTUAL_ROOT = 'VIRTUAL_ROOT';
const SHARED_ROOT = 'SHARED_ROOT';

export const useDriveStore = create((set, get) => ({
  // State
  currentPath: [], 
  currentFolderId: VIRTUAL_ROOT, 
  items: [], 
  spaceInfo: null,
  isLoading: false,
  viewMode: 'grid',
  error: null,

  // Actions
  setViewMode: (mode) => set({ viewMode: mode }),

  // Inițializare
  initializeDrive: async () => {
    set({ isLoading: true, error: null });
    try {
      const space = await driveService.getUserSpace();
      set({ spaceInfo: space });
      
      const params = new URLSearchParams(window.location.search);
      const folderFromUrl = params.get('folder');

      await get().loadFolder(folderFromUrl || VIRTUAL_ROOT);
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  refreshSpaceInfo: async () => {
      try {
          const space = await driveService.getUserSpace();
          set({ spaceInfo: space });
      } catch (error) {
          console.error("Failed to refresh space info:", error);
      }
  },

  loadFolder: async (folderId) => {
    const { spaceInfo } = get();
    if (!spaceInfo && folderId !== VIRTUAL_ROOT) return;

    set({ isLoading: true, error: null, currentFolderId: folderId });

    // URL Update
    const url = new URL(window.location);
    if (folderId && folderId !== VIRTUAL_ROOT) {
        url.searchParams.set('folder', folderId);
    } else {
        url.searchParams.delete('folder');
    }
    window.history.pushState({}, '', url);

    try {
      let items = [];
      let newPath = [];

      // --- 1. VIRTUAL ROOT ---
      if (folderId === VIRTUAL_ROOT) {
        items = [
          { id: 'my-drive-entry', name: 'My Drive', type: 'folder', isVirtual: true, icon: 'hard-drive' },
          { id: SHARED_ROOT, name: 'Shared with Me', type: 'folder', isVirtual: true, icon: 'users' }
        ];
        newPath = [{ id: VIRTUAL_ROOT, name: 'Home' }];
      } 
      
      // --- 2. DIRECT MY DRIVE ---
      else if (folderId === 'my-drive-entry') {
        const rootContents = await driveService.getFolderContents(spaceInfo.id, null);
        const realMyDriveFolder = rootContents.find(i => i.type === 'folder' && i.name === 'My Drive');

        if (realMyDriveFolder) {
            // Intrăm direct în folderul real
            const actualItems = await driveService.getFolderContents(spaceInfo.id, realMyDriveFolder.id);
            items = actualItems;
            newPath = [
                { id: VIRTUAL_ROOT, name: 'Home' },
                { id: realMyDriveFolder.id, name: 'My Drive' }
            ];
            // Setăm ID-ul real pentru viitoarele operațiuni
            set({ currentFolderId: realMyDriveFolder.id });
            
            // Corectăm URL-ul cu ID-ul real
            url.searchParams.set('folder', realMyDriveFolder.id);
            window.history.pushState({}, '', url);
        } else {
            // Fallback
            items = rootContents;
            newPath = [{ id: VIRTUAL_ROOT, name: 'Home' }, { id: null, name: 'My Drive' }];
        }
      }

      // --- 3. SHARED ROOT ---
      else if (folderId === SHARED_ROOT) {
        items = await driveService.getSharedWithMe();
        newPath = [
            { id: VIRTUAL_ROOT, name: 'Home' },
            { id: SHARED_ROOT, name: 'Shared with Me' }
        ];
      }

      // --- 4. STANDARD FOLDER ---
      else {
        items = await driveService.getFolderContents(spaceInfo.id, folderId);
        const backendCrumbs = await driveService.getBreadcrumbs(folderId);
        
        const cleanBackendCrumbs = backendCrumbs
            .filter(c => c.id !== 'root')
            .map(c => c.name === 'My Drive' ? { ...c, name: 'My Drive' } : c);

        newPath = [
            { id: VIRTUAL_ROOT, name: 'Home' },
            ...cleanBackendCrumbs
        ];
      }

      set({ items, currentPath: newPath, isLoading: false });

    } catch (err) {
      console.error(err);
      set({ error: err.message, isLoading: false });
    }
  },
  
  navigateToBreadcrumb: (folderId, index) => {
      if (index === 0) {
          get().loadFolder(VIRTUAL_ROOT);
          return;
      }
      get().loadFolder(folderId);
  },

  refreshCurrentFolder: async () => {
    const { currentFolderId } = get();
    await get().loadFolder(currentFolderId);
  },

  createFolder: async (name) => {
    const { spaceInfo, currentFolderId } = get();
    if (currentFolderId === VIRTUAL_ROOT || currentFolderId === SHARED_ROOT) {
        set({ error: "Nu poți crea foldere aici." });
        return;
    }
    
    try {
      await driveService.createFolder(spaceInfo.id, currentFolderId, name);
      await get().loadFolder(currentFolderId);
    } catch (err) {
      set({ error: err.message });
    }
  },

  uploadFile: async (file) => {
    const { spaceInfo, currentFolderId } = get();
    if (currentFolderId === VIRTUAL_ROOT || currentFolderId === SHARED_ROOT) {
        set({ error: "Nu poți încărca fișiere aici." });
        return;
    }

    set({ isLoading: true }); 
    try {
      await driveService.uploadFile(file, spaceInfo.id, currentFolderId);
      await get().loadFolder(currentFolderId);
      await get().refreshSpaceInfo();
    } catch (err) {
      console.error(err);
      set({ error: "Eroare la upload: " + err.message, isLoading: false });
    }
  }

}));
