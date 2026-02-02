import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useDriveStore } from '../store/useDriveStore';
import { 
    Folder, FileText, FileImage, MoreVertical, Loader2, UploadCloud, HardDrive, Users, 
    Download, Trash2, Edit2, Share2, Eye, RefreshCcw, Scissors, Copy, ClipboardPaste 
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ContextMenu } from './ContextMenu';
import { driveService } from '../services/driveService';

// Helper pentru iconițe
const ItemIcon = ({ item, className }) => {
  if (item.isVirtual) {
      if (item.icon === 'hard-drive') return <HardDrive className={`text-primary fill-primary/10 ${className}`} />;
      if (item.icon === 'users') return <Users className={`text-purple-600 fill-purple-100 ${className}`} />;
      if (item.icon === 'trash') return <Trash2 className={`text-destructive fill-destructive/10 ${className}`} />;
  }
  if (item.type === 'folder') return <Folder className={`text-primary fill-primary/20 ${className}`} />;
  if (item.mime_type?.startsWith('image/')) return <FileImage className={`text-blue-400 ${className}`} />;
  return <FileText className={`text-blue-400 ${className}`} />;
};

export const DriveExplorer = () => {
  const { 
      items, isLoading, loadFolder, initializeDrive, uploadFile, currentFolderId, 
      selectedItemIds, toggleSelection, selectAll, clearSelection,
      deleteItem, deletePermanently, restoreItem, renameItem, viewMode, createFolder,
      searchQuery, error, setClipboard, clipboard, paste
  } = useDriveStore();
  
  const [isDragging, setIsDragging] = useState(false);
  
  const [contextMenu, setContextMenu] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    initializeDrive();
    // Click outside to clear selection (if not clicking on item)
    const handleGlobalClick = (e) => {
        if (!e.target.closest('.drive-item') && !e.target.closest('.context-menu')) {
            clearSelection();
        }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  // --- Actions for Background Context Menu ---
  const handleCreateFolder = async () => {
      const name = prompt("Introdu numele folderului:");
      if (name) {
          await createFolder(name);
      }
  };

  const handleUploadTrigger = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
      if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          await uploadFile(file);
      }
      e.target.value = '';
  };

  // --- Drag & Drop Handlers ---
  const handleDragOver = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    if (currentFolderId === 'VIRTUAL_ROOT' || currentFolderId === 'SHARED_ROOT' || currentFolderId === 'TRASH_ROOT') return;
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  }, [currentFolderId]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
    if (currentFolderId === 'VIRTUAL_ROOT' || currentFolderId === 'SHARED_ROOT' || currentFolderId === 'TRASH_ROOT') return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      for (const file of files) await uploadFile(file);
    }
  }, [uploadFile, currentFolderId]);

  // --- Item Interaction ---
  const handleItemClick = (e, item) => {
      e.stopPropagation();
      // Ctrl/Cmd key for multi-select
      const isMulti = e.ctrlKey || e.metaKey;
      toggleSelection(item.id, isMulti);
  };

  const handleItemDoubleClick = (e, item) => {
      e.stopPropagation();
      if (item.type === 'folder' || item.isVirtual) {
          loadFolder(item.id);
          clearSelection();
      } else {
          // Open File Logic (Preview)
          handleDownload(item, true); // True for preview/open tab
      }
  };

  const handleDownload = async (item, openInTab = false) => {
      try {
          const url = await driveService.getFileUrl(item.id);
          if (openInTab) window.open(url, '_blank');
          else {
              // Trigger download
              const link = document.createElement('a');
              link.href = url;
              link.download = item.name;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
          }
      } catch (err) {
          console.error("Download failed:", err);
          alert("Eroare la descărcare.");
      }
  };

  const handleRename = async (item) => {
      const newName = prompt("Introdu noul nume:", item.name);
      if (newName && newName !== item.name) {
          await renameItem(item.id, item.type, newName);
      }
  };

  const handleDelete = async (item) => {
      if (confirm(`Ești sigur că vrei să muți "${item.name}" în coșul de gunoi?`)) {
          await deleteItem(item.id, item.type);
      }
  };

  const handleDeletePermanently = async (item) => {
      if (confirm(`ATENȚIE: "${item.name}" va fi șters DEFINITIV. Această acțiune este ireversibilă. Continui?`)) {
          await deletePermanently(item.id, item.type);
      }
  };

  const handleRestore = async (item) => {
      await restoreItem(item.id, item.type);
  };

  const handleContextMenu = (e, item) => {
      e.preventDefault();
      e.stopPropagation();

      if (!selectedItemIds.includes(item.id)) {
          toggleSelection(item.id, false);
      }

      const menuItems = [];
      const isInTrash = item.is_in_trash || currentFolderId === 'TRASH_ROOT';

      if (isInTrash) {
           menuItems.push({ label: 'Restaurează', icon: RefreshCcw, action: () => handleRestore(item) });
           menuItems.push({ separator: true });
           menuItems.push({ label: 'Șterge Definitiv', icon: Trash2, danger: true, action: () => handleDeletePermanently(item) });
      } else {
          // Standard Items
          if (item.type === 'folder' || item.isVirtual) {
              menuItems.push({ label: 'Deschide', icon: Eye, action: () => { loadFolder(item.id); clearSelection(); } });
          } else {
              menuItems.push({ label: 'Deschide', icon: Eye, action: () => handleDownload(item, true) });
              menuItems.push({ label: 'Descarcă', icon: Download, action: () => handleDownload(item, false) });
          }

          if (!item.isVirtual && !item.is_shared) { 
              menuItems.push({ separator: true });
              menuItems.push({ label: 'Taie (Cut)', icon: Scissors, action: () => {
                const selectedItems = items.filter(i => selectedItemIds.includes(i.id));
                setClipboard(selectedItems.length > 0 ? selectedItems : [item], 'cut');
              }});
              menuItems.push({ label: 'Copiază (Copy)', icon: Copy, action: () => {
                const selectedItems = items.filter(i => selectedItemIds.includes(i.id));
                setClipboard(selectedItems.length > 0 ? selectedItems : [item], 'copy');
              }});
              menuItems.push({ separator: true });
              menuItems.push({ label: 'Redenumire', icon: Edit2, action: () => handleRename(item) });
              menuItems.push({ separator: true });
              menuItems.push({ label: 'Șterge', icon: Trash2, danger: true, action: () => handleDelete(item) });
          }
      }

      setContextMenu({ x: e.clientX, y: e.clientY, items: menuItems });
  };

  const handleBackgroundContextMenu = (e) => {
      e.preventDefault();
      
      // Don't show create options in virtual folders where we can't write
      if (currentFolderId === 'VIRTUAL_ROOT' || currentFolderId === 'SHARED_ROOT' || currentFolderId === 'TRASH_ROOT') {
          setContextMenu(null);
          return;
      }

      const backgroundItems = [
          { label: 'Folder Nou', icon: Folder, action: handleCreateFolder },
          { label: 'Încarcă Fișier', icon: UploadCloud, action: handleUploadTrigger }
      ];

      if (clipboard.items.length > 0) {
          backgroundItems.push({ separator: true });
          backgroundItems.push({ label: `Lipește (${clipboard.items.length} elemente)`, icon: ClipboardPaste, action: paste });
      }

      setContextMenu({
          x: e.clientX,
          y: e.clientY,
          items: backgroundItems
      });
  };

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const currentError = useDriveStore.getState().error;
  if (currentError) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="text-destructive mb-4">Eroare: {currentError}</div>
        <Button onClick={() => initializeDrive()}>Încearcă din nou</Button>
      </div>
    );
  }

  return (
    <div 
        className="relative flex-1 w-full select-none flex flex-col" // Fill remaining height without forcing overflow
        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
        onContextMenu={handleBackgroundContextMenu}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handleFileChange} 
      />

      {isDragging && (
        <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-primary border-dashed rounded-xl flex flex-col items-center justify-center backdrop-blur-sm pointer-events-none">
            <UploadCloud className="h-16 w-16 text-primary animate-bounce" />
            <h3 className="text-xl font-bold text-primary mt-4">Plasează fișierele aici</h3>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground pointer-events-none">
          <Folder className="h-12 w-12 mb-4 opacity-20" />
          <p>{searchQuery ? 'Nu am găsit niciun rezultat.' : 'Acest folder este gol.'}</p>
        </div>
      ) : (
        <div className="shrink-0"> {/* Wrapper for content to prevent flex-1 stretching items improperly */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {items.map((item) => {
                const isSelected = selectedItemIds.includes(item.id);
                return (
                    <Card 
                        key={item.id}
                        className={`drive-item group relative border shadow-sm transition-all cursor-pointer rounded-xl overflow-hidden aspect-[4/3] flex flex-col p-4
                            ${isSelected ? 'bg-primary/10 border-primary ring-1 ring-primary' : 'bg-card border-border hover:border-primary/50 hover:shadow-md'}
                        `}
                        onClick={(e) => handleItemClick(e, item)}
                        onDoubleClick={(e) => handleItemDoubleClick(e, item)}
                        onContextMenu={(e) => handleContextMenu(e, item)}
                    >
                        {/* Selection Checkbox (Visible on hover or selected) */}
                        <div className={`absolute top-2 left-2 z-10 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'bg-background border-input'}`}>
                                {isSelected && <div className="w-2.5 h-1.5 border-l-2 border-b-2 border-primary-foreground -mt-0.5 rotate-[-45deg]" />}
                            </div>
                        </div>

                        <div className="flex-1 flex items-center justify-center pointer-events-none">
                            <ItemIcon item={item} className={item.isVirtual ? "h-16 w-16" : "h-12 w-12"} />
                        </div>

                        <div className="mt-3 text-center w-full">
                            <div className="text-sm font-medium text-foreground truncate px-1" title={item.name}>
                                {item.name}
                            </div>
                            {!item.isVirtual && (
                                <div className="text-[10px] text-muted-foreground mt-0.5 flex justify-center items-center gap-1">
                                    {item.size ? (item.size / 1024).toFixed(1) + ' KB' : 'Item'}
                                </div>
                            )}
                        </div>
                    </Card>
                );
                })}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
                {/* List Header */}
                <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border">
                    <div className="col-span-6">Nume</div>
                    <div className="col-span-2">Mărime</div>
                    <div className="col-span-4">Tip</div>
                </div>
                {items.map((item) => {
                    const isSelected = selectedItemIds.includes(item.id);
                    return (
                        <div 
                            key={item.id}
                            className={`drive-item group grid grid-cols-12 gap-4 px-4 py-2 items-center rounded-md cursor-pointer transition-colors
                                ${isSelected ? 'bg-primary/10' : 'hover:bg-accent'}
                            `}
                            onClick={(e) => handleItemClick(e, item)}
                            onDoubleClick={(e) => handleItemDoubleClick(e, item)}
                            onContextMenu={(e) => handleContextMenu(e, item)}
                        >
                             <div className="col-span-6 flex items-center gap-3 overflow-hidden">
                                 <div className="flex-shrink-0">
                                     <ItemIcon item={item} className="h-5 w-5" />
                                 </div>
                                 <span className={`text-sm font-medium truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                                     {item.name}
                                 </span>
                             </div>
                             <div className="col-span-2 text-xs text-muted-foreground">
                                 {!item.isVirtual && item.size ? (item.size / 1024).toFixed(1) + ' KB' : '-'}
                             </div>
                             <div className="col-span-4 text-xs text-muted-foreground truncate">
                                 {item.isVirtual ? 'Folder de sistem' : (item.type === 'folder' ? 'Folder' : item.mime_type || 'Fișier')}
                             </div>
                        </div>
                    );
                })}
            </div>
          )}
        </div>
      )}

      {/* This space takes the rest of the vertical area, capturing context clicks correctly */}
      <div className="flex-1 min-h-[50px]" /> 

      {contextMenu && (
          <ContextMenu 
            key={`${contextMenu.x}-${contextMenu.y}`}
            x={contextMenu.x} 
            y={contextMenu.y} 
            items={contextMenu.items} 
            onClose={() => setContextMenu(null)} 
          />
      )}
    </div>
  );
};