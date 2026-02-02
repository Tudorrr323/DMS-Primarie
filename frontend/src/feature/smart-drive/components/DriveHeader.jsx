import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Grid, List as ListIcon, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDriveStore } from '../store/useDriveStore';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '@/hooks/useDebounce';

export const DriveHeader = () => {
  const { viewMode, setViewMode, setSearchQuery, searchQuery } = useDriveStore();
  const navigate = useNavigate();
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debouncedSearch = useDebounce(localSearch, 300);

  useEffect(() => {
    // Sincronizare localSearch dacă se schimbă searchQuery din store (ex: la reset)
    if (searchQuery === '' && localSearch !== '') {
        setLocalSearch('');
    }
  }, [searchQuery]);

  useEffect(() => {
    // Trimite către store doar dacă valoarea s-a schimbat efectiv față de store
    if (debouncedSearch !== searchQuery) {
        setSearchQuery(debouncedSearch);
    }
  }, [debouncedSearch, setSearchQuery, searchQuery]);

  return (
    <div className="flex items-center justify-between w-full">
      {/* Title & Back */}
      <div className="flex items-center gap-4 w-64">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 rounded-full"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">Fișiere</h1>
      </div>

      {/* Search Bar */}
      <div className="flex-1 max-w-2xl px-4">
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Caută..." 
                className="pl-10 bg-muted/50 border-input focus-visible:ring-primary rounded-md"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
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
