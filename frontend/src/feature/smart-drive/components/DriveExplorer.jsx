import React, { useEffect, useState, useCallback } from 'react';
import { useDriveStore } from '../store/useDriveStore';
import { Folder, FileText, FileImage, MoreVertical, Loader2, UploadCloud, HardDrive, Users, Download, Trash2, Edit2, Share2, Eye, RefreshCcw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ContextMenu } from './ContextMenu';
import { driveService } from '../services/driveService';

// Helper pentru iconițe
const ItemIcon = ({ item, className }) => {
  if (item.isVirtual) {
      if (item.icon === 'hard-drive') return <HardDrive className={`text-blue-600 fill-blue-100 ${className}`} />;
      if (item.icon === 'users') return <Users className={`text-purple-600 fill-purple-100 ${className}`} />;
      if (item.icon === 'trash') return <Trash2 className={`text-red-600 fill-red-100 ${className}`} />;
  }
  if (item.type === 'folder') return <Folder className={`text-blue-500 fill-blue-500 ${className}`} />;
  if (item.mime_type?.startsWith('image/')) return <FileImage className={`text-blue-400 ${className}`} />;
  return <FileText className={`text-blue-400 ${className}`} />;
};

export const DriveExplorer = () => {
  const { 
      items, isLoading, loadFolder, initializeDrive, uploadFile, currentFolderId, 
      selectedItemIds, toggleSelection, selectAll, clearSelection,
      deleteItem, deletePermanently, restoreItem, renameItem 
  } = useDriveStore();
  
  const [isDragging, setIsDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);

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
              menuItems.push({ label: 'Redenumire', icon: Edit2, action: () => handleRename(item) });
              menuItems.push({ separator: true });
              menuItems.push({ label: 'Șterge', icon: Trash2, danger: true, action: () => handleDelete(item) });
          }
      }

      setContextMenu({ x: e.clientX, y: e.clientY, items: menuItems });
  };

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>;
  }

  return (
    <div 
        className="relative min-h-[400px] select-none" // Disable text selection for better file manager feel
        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
        onContextMenu={(e) => {
            e.preventDefault();
            // Background context menu (Create folder, Refresh) - Optional
            setContextMenu(null);
        }}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-blue-500/10 border-2 border-blue-500 border-dashed rounded-xl flex flex-col items-center justify-center backdrop-blur-sm pointer-events-none">
            <UploadCloud className="h-16 w-16 text-blue-600 animate-bounce" />
            <h3 className="text-xl font-bold text-blue-700 mt-4">Drop files here</h3>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {items.map((item) => {
          const isSelected = selectedItemIds.includes(item.id);
          return (
            <Card 
                key={item.id}
                className={`drive-item group relative border shadow-sm transition-all cursor-pointer rounded-xl overflow-hidden aspect-[4/3] flex flex-col p-4
                    ${isSelected ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'}
                `}
                onClick={(e) => handleItemClick(e, item)}
                onDoubleClick={(e) => handleItemDoubleClick(e, item)}
                onContextMenu={(e) => handleContextMenu(e, item)}
            >
                {/* Selection Checkbox (Visible on hover or selected) */}
                <div className={`absolute top-2 left-2 z-10 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-300'}`}>
                        {isSelected && <div className="w-2.5 h-1.5 border-l-2 border-b-2 border-white -mt-0.5 rotate-[-45deg]" />}
                    </div>
                </div>

                <div className="flex-1 flex items-center justify-center pointer-events-none">
                    <ItemIcon item={item} className={item.isVirtual ? "h-16 w-16" : "h-12 w-12"} />
                </div>

                <div className="mt-3 text-center w-full">
                    <div className="text-sm font-medium text-slate-700 truncate px-1" title={item.name}>
                        {item.name}
                    </div>
                    {!item.isVirtual && (
                        <div className="text-[10px] text-slate-400 mt-0.5 flex justify-center items-center gap-1">
                            {item.size ? (item.size / 1024).toFixed(1) + ' KB' : 'Item'}
                        </div>
                    )}
                </div>
            </Card>
          );
        })}
      </div>

      {contextMenu && (
          <ContextMenu 
            x={contextMenu.x} 
            y={contextMenu.y} 
            items={contextMenu.items} 
            onClose={() => setContextMenu(null)} 
          />
      )}
    </div>
  );
};