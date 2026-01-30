import React, { useEffect, useState, useCallback } from 'react';
import { useDriveStore } from '../store/useDriveStore';
import { Folder, FileText, FileImage, MoreVertical, Loader2, UploadCloud, HardDrive, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Helper pentru iconițe (Stilizare conform screenshot, dar cu restaurarea iconițelor virtuale)
const ItemIcon = ({ item, className }) => {
  // Virtual Items (Home Screen)
  if (item.isVirtual) {
      if (item.icon === 'hard-drive') return <HardDrive className={`text-blue-600 fill-blue-100 ${className}`} />;
      if (item.icon === 'users') return <Users className={`text-purple-600 fill-purple-100 ${className}`} />;
  }
  
  // Folder: Albastru plin (Standard)
  if (item.type === 'folder') return <Folder className={`text-blue-500 fill-blue-500 ${className}`} />;
  
  // File: Albastru deschis (contur)
  if (item.mime_type?.startsWith('image/')) return <FileImage className={`text-blue-400 ${className}`} />;
  return <FileText className={`text-blue-400 ${className}`} />;
};

export const DriveExplorer = () => {
  const { items, isLoading, viewMode, loadFolder, initializeDrive, uploadFile, currentFolderId } = useDriveStore();
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    initializeDrive();
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    if (currentFolderId === 'VIRTUAL_ROOT' || currentFolderId === 'SHARED_ROOT') return;
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
    if (currentFolderId === 'VIRTUAL_ROOT' || currentFolderId === 'SHARED_ROOT') return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      for (const file of files) await uploadFile(file);
    }
  }, [uploadFile, currentFolderId]);

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>;
  }

  // Grid Layout
  return (
    <div 
        className="relative min-h-[400px]"
        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-blue-500/10 border-2 border-blue-500 border-dashed rounded-xl flex flex-col items-center justify-center backdrop-blur-sm">
            <UploadCloud className="h-16 w-16 text-blue-600 animate-bounce" />
            <h3 className="text-xl font-bold text-blue-700 mt-4">Drop files here</h3>
        </div>
      )}

      {/* Grid Content */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {items.map((item) => (
          <Card 
            key={item.id}
            className="group relative bg-white border-none shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all cursor-pointer rounded-xl overflow-hidden aspect-[4/3] flex flex-col p-5"
            onClick={() => (item.type === 'folder' || item.isVirtual) && loadFolder(item.id)}
          >
             {/* Icon Area - Centered */}
             <div className="flex-1 flex items-center justify-center">
                <ItemIcon item={item} className={item.isVirtual ? "h-16 w-16" : "h-14 w-14"} />
             </div>

             {/* Footer Area - Name & Context */}
             <div className="mt-4 flex items-center justify-between w-full">
                <div className="flex flex-col overflow-hidden">
                    <span className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-0.5">
                        {item.type === 'folder' || item.isVirtual ? 'Folder' : 'File'}
                    </span>
                    <span className="text-sm font-semibold text-slate-700 truncate" title={item.name}>
                        {item.name}
                    </span>
                </div>
                
                {!item.isVirtual && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-600 -mr-2">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                )}
             </div>
          </Card>
        ))}
      </div>
    </div>
  );
};