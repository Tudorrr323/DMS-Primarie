import { create } from 'zustand';
import { driveService } from '../services/driveService';

const VIRTUAL_ROOT = 'VIRTUAL_ROOT';
const SHARED_ROOT = 'SHARED_ROOT';
const TRASH_ROOT = 'TRASH_ROOT';

export const useDriveStore = create((set, get) => ({
  // State
  currentPath: [], 
  currentFolderId: VIRTUAL_ROOT, 
  items: [], 
  spaceInfo: null,
  isLoading: false,
  viewMode: 'grid',
  error: null,
  
  // Sidebar Refresh Signaling
  sidebarRefresh: { count: 0, targetId: null },
  
  // Selection
  selectedItemIds: [],

  // Actions
  triggerSidebarRefresh: (targetId) => set((state) => ({
      sidebarRefresh: { count: state.sidebarRefresh.count + 1, targetId }
  })),

  toggleSelection: (itemId, multiSelect) => set((state) => {
      if (multiSelect) {
          const isSelected = state.selectedItemIds.includes(itemId);
          return {
              selectedItemIds: isSelected 
                  ? state.selectedItemIds.filter(id => id !== itemId)
                  : [...state.selectedItemIds, itemId]
          };
      }
      return { selectedItemIds: [itemId] };
  }),

  selectAll: () => set((state) => ({
      selectedItemIds: state.items.map(i => i.id)
  })),

  clearSelection: () => set({ selectedItemIds: [] }),

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
            const actualItems = await driveService.getFolderContents(spaceInfo.id, realMyDriveFolder.id);
            items = actualItems;
            newPath = [
                { id: VIRTUAL_ROOT, name: 'Home' },
                { id: realMyDriveFolder.id, name: 'My Drive' }
            ];
            set({ currentFolderId: realMyDriveFolder.id });
            url.searchParams.set('folder', realMyDriveFolder.id);
            window.history.pushState({}, '', url);
        } else {
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

      // --- 3.5 TRASH ROOT ---
      else if (folderId === TRASH_ROOT) {
        items = await driveService.getTrashItems();
        newPath = [
            { id: VIRTUAL_ROOT, name: 'Home' },
            { id: TRASH_ROOT, name: 'Trash' }
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
    if (currentFolderId === VIRTUAL_ROOT || currentFolderId === SHARED_ROOT || currentFolderId === TRASH_ROOT) {
        set({ error: "Nu poți crea foldere aici." });
        return;
    }
    
    try {
      await driveService.createFolder(spaceInfo.id, currentFolderId, name);
      await get().loadFolder(currentFolderId);
      get().triggerSidebarRefresh(currentFolderId);
    } catch (err) {
      set({ error: err.message });
    }
  },

  uploadFile: async (file) => {
    const { spaceInfo, currentFolderId } = get();
    if (currentFolderId === VIRTUAL_ROOT || currentFolderId === SHARED_ROOT || currentFolderId === TRASH_ROOT) {
        set({ error: "Nu poți încărca fișiere aici." });
        return;
    }

    set({ isLoading: true }); 
    try {
      await driveService.uploadFile(file, spaceInfo.id, currentFolderId);
      await get().loadFolder(currentFolderId);
      
      // Strategie Dublă Verificare pentru Bara de Stocare
      // 1. Refresh Rapid (pentru majoritatea cazurilor)
      setTimeout(() => get().refreshSpaceInfo(), 1000);
      
      // 2. Refresh de Siguranță (pentru latențe DB/Trigger)
      setTimeout(() => get().refreshSpaceInfo(), 3500);
      
    } catch (err) {
      console.error(err);
      set({ error: "Eroare la upload: " + err.message, isLoading: false });
    }
  },

  deleteItem: async (itemId, type) => {
      set({ isLoading: true });
      try {
          await driveService.deleteItem(itemId, type);
          await get().refreshCurrentFolder();
          get().triggerSidebarRefresh(get().currentFolderId);
          // NU apelăm refreshSpaceInfo aici deoarece Trash-ul ocupă în continuare spațiu
      } catch (err) {
          set({ error: "Eroare la ștergere: " + err.message, isLoading: false });
      }
  },

  deletePermanently: async (itemId, type) => {
      set({ isLoading: true });
      try {
          await driveService.deletePermanently(itemId, type);
          await get().refreshCurrentFolder();
          get().triggerSidebarRefresh(get().currentFolderId);
          // Aici este critic să actualizăm spațiul
          setTimeout(() => get().refreshSpaceInfo(), 800);
      } catch (err) {
          set({ error: "Eroare la ștergere definitivă: " + err.message, isLoading: false });
      }
  },

  restoreItem: async (itemId, type) => {
      set({ isLoading: true });
      try {
          await driveService.restoreItem(itemId, type);
          await get().refreshCurrentFolder();
          get().triggerSidebarRefresh(get().currentFolderId);
      } catch (err) {
          set({ error: "Eroare la restaurare: " + err.message, isLoading: false });
      }
  },

  renameItem: async (itemId, type, newName) => {
      set({ isLoading: true });
      try {
          await driveService.renameItem(itemId, type, newName);
          await get().refreshCurrentFolder();
          get().triggerSidebarRefresh(get().currentFolderId);
      } catch (err) {
          set({ error: "Eroare la redenumire: " + err.message, isLoading: false });
      }
  }

}));