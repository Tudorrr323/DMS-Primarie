import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { useDriveStore } from '../store/useDriveStore';
import { Button } from '@/components/ui/button';

export const DriveBreadcrumb = () => {
  const { currentPath, navigateToBreadcrumb, loadFolder } = useDriveStore();

  // Dacă path-ul e gol sau undefined, afișăm măcar Root
  const displayPath = (currentPath && currentPath.length > 0) 
    ? currentPath 
    : [{ id: 'root', name: 'Files' }];

  return (
    <nav className="flex items-center text-sm text-muted-foreground">
      {displayPath.map((folder, index) => {
        const isLast = index === displayPath.length - 1;
        const isRoot = folder.id === 'VIRTUAL_ROOT';

        return (
          <div key={folder.id || index} className="flex items-center">
            {index > 0 && <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground" />}
            
            <Button
              variant="link"
              className={`p-0 h-auto font-normal flex items-center hover:no-underline ${
                isLast 
                  ? 'font-semibold text-foreground pointer-events-none' 
                  : 'text-muted-foreground hover:text-primary'
              }`}
              onClick={() => {
                  if (isRoot) loadFolder('VIRTUAL_ROOT');
                  else navigateToBreadcrumb(folder.id, index);
              }}
            >
              {isRoot && <Home className="h-4 w-4 mr-1" />}
              {folder.name}
            </Button>
          </div>
        );
      })}
    </nav>
  );
};