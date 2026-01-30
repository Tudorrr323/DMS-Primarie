import React from 'react';
import { Input } from '@/components/ui/input';
import { Search, Grid, List as ListIcon, Settings, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDriveStore } from '../store/useDriveStore';

export const DriveHeader = () => {
  const { viewMode, setViewMode } = useDriveStore();

  return (
    <div className="flex items-center justify-between w-full">
      {/* Title */}
      <div className="flex items-center w-64">
        <h1 className="text-lg font-semibold text-slate-800">Files</h1>
      </div>

      {/* Search Bar */}
      <div className="flex-1 max-w-2xl px-4">
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
                placeholder="Search" 
                className="pl-10 bg-slate-50 border-slate-200 focus-visible:ring-blue-500 rounded-md"
            />
        </div>
      </div>

      {/* Actions Right */}
      <div className="flex items-center gap-2 w-auto justify-end">
         {/* Theme Selector Mock */}
         <div className="flex items-center gap-2 mr-4 text-sm text-slate-600 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
            <span className="text-slate-400">Theme</span>
            <div className="w-3 h-3 rounded-full bg-blue-400"></div>
            <span className="font-medium">Willow</span>
         </div>

         <div className="flex bg-slate-100 rounded-md p-1 gap-1">
            <Button 
                variant="ghost" 
                size="sm" 
                className={`h-7 w-7 p-0 ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                onClick={() => setViewMode('list')}
            >
                <Eye className="h-4 w-4" />
            </Button>
            <Button 
                variant="ghost" 
                size="sm" 
                className={`h-7 w-7 p-0 ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                onClick={() => setViewMode('grid')}
            >
                <Grid className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500">
                <ListIcon className="h-4 w-4" />
            </Button>
         </div>
      </div>
    </div>
  );
};
