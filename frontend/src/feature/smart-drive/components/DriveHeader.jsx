import React from 'react';
import { Input } from '@/components/ui/input';
import { Search, Grid, List as ListIcon, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDriveStore } from '../store/useDriveStore';

export const DriveHeader = () => {
  const { viewMode, setViewMode } = useDriveStore();

  return (
    <div className="flex items-center justify-between w-full">
      {/* Title */}
      <div className="flex items-center w-64">
        <h1 className="text-lg font-semibold text-foreground">Files</h1>
      </div>

      {/* Search Bar */}
      <div className="flex-1 max-w-2xl px-4">
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Search" 
                className="pl-10 bg-muted/50 border-input focus-visible:ring-primary rounded-md"
            />
        </div>
      </div>

      {/* Actions Right */}
      <div className="flex items-center gap-2 w-auto justify-end">
         <div className="flex bg-muted rounded-md p-1 gap-1">
            <Button 
                variant="ghost" 
                size="sm" 
                className={`h-7 w-7 p-0 ${viewMode === 'list' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
                onClick={() => setViewMode('list')}
            >
                <ListIcon className="h-4 w-4" />
            </Button>
            <Button 
                variant="ghost" 
                size="sm" 
                className={`h-7 w-7 p-0 ${viewMode === 'grid' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
                onClick={() => setViewMode('grid')}
            >
                <Grid className="h-4 w-4" />
            </Button>
         </div>
      </div>
    </div>
  );
};
