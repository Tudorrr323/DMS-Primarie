import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronDown, Folder, HardDrive, Users, Plus, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { useDriveStore } from '../store/useDriveStore';
import { driveService } from '../services/driveService';

// --- Recursive Tree Node ---
const TreeNode = ({ node, level = 0, activeId, onSelect, onToggleExpand }) => {
  const isExpanded = node.isExpanded;
  const isActive = activeId === node.id;
  const hasChildren = node.children && node.children.length > 0;
  const paddingLeft = level * 12 + 12; // Indentare progresivă

  // Iconița specifică (Root vs Folder)
  let Icon = Folder;
  if (node.id === 'my-drive-root') Icon = HardDrive;
  if (node.id === 'shared-root') Icon = Users;
  if (node.id === 'trash-root') Icon = Trash2;

  return (
    <div className="flex flex-col select-none">
      <div 
        className={`flex items-center gap-2 py-1.5 pr-2 text-sm rounded-r-md cursor-pointer transition-colors border-l-2 ${
          isActive 
            ? 'bg-primary/10 text-primary border-primary' 
            : 'text-muted-foreground hover:bg-accent border-transparent'
        }`}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={(e) => {
            e.stopPropagation();
            onSelect(node);
        }}
      >
        {/* Toggle Button */}
        <div 
          className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground z-10"
          onClick={(e) => {
            e.stopPropagation();
            // Doar dacă e My Drive sau folder normal, permitem expand
            if (node.id === 'my-drive-root' || node.type === 'folder') {
                onToggleExpand(node);
            }
          }}
        >
          {(node.id === 'my-drive-root' || node.type === 'folder') && (
             isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          )}
        </div>
        
        <Icon size={16} className={isActive ? "text-primary" : "text-muted-foreground"} />
        <span className="font-medium truncate">{node.name}</span>
      </div>

      {/* Render Children */}
      {isExpanded && node.children && (
        <div className="flex flex-col">
            {node.isLoading ? (
                <div className="pl-8 py-1 text-xs text-muted-foreground flex items-center">
                    <Loader2 size={10} className="animate-spin mr-2" /> Loading...
                </div>
            ) : (
                node.children.map(child => (
                    <TreeNode 
                        key={child.id} 
                        node={child} 
                        level={level + 1} 
                        activeId={activeId}
                        onSelect={onSelect}
                        onToggleExpand={onToggleExpand}
                    />
                ))
            )}
        </div>
      )}
    </div>
  );
};

export const DriveSidebar = () => {
  const { spaceInfo, currentFolderId, loadFolder, createFolder, uploadFile, sidebarRefresh } = useDriveStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const fileInputRef = useRef(null);

  const handleCreateFolder = async () => {
      setIsMenuOpen(false);
      const name = prompt("Introdu numele folderului:");
      if (name) {
          await createFolder(name);
      }
  };

  const handleUploadTrigger = () => {
      setIsMenuOpen(false);
      fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
      if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          await uploadFile(file);
      }
      e.target.value = '';
  };
  
  // Starea arborelui (ierarhică)
  const [treeData, setTreeData] = useState([
      { id: 'my-drive-root', name: 'My Drive', type: 'root', isExpanded: true, children: [], dbId: null },
      { id: 'shared-root', name: 'Shared with Me', type: 'root', isExpanded: false, children: [] },
      { id: 'trash-root', name: 'Trash', type: 'root', isExpanded: false, children: [], icon: 'trash' }
  ]);

  // Inițializare: Încărcăm My Drive la prima randare dacă avem spaceInfo
  useEffect(() => {
      if (spaceInfo?.id) {
          fetchSubfolders('my-drive-root', null);
      }
  }, [spaceInfo?.id]);

  // --- LAZY REFRESH LISTENER ---
  useEffect(() => {
    if (sidebarRefresh.count > 0 && sidebarRefresh.targetId) {
        // Find the node that corresponds to this targetId and refresh it if expanded
        const targetId = sidebarRefresh.targetId;
        
        // Helper to find node in tree
        const findAndRefresh = (nodes) => {
            for (const node of nodes) {
                // Check if this node matches the target
                // For root 'my-drive-root', we check its dbId. For others, we check id.
                const isMatch = (node.id === targetId) || (node.dbId === targetId);

                if (isMatch) {
                    if (node.isExpanded) {
                         // Force refresh
                         const refreshDbId = (node.id === 'my-drive-root') ? node.dbId : node.id;
                         fetchSubfolders(node.id, refreshDbId);
                    }
                    return true; // Stop searching this branch if found (though ID should be unique)
                }
                
                if (node.children) {
                    const found = findAndRefresh(node.children);
                    if (found) return true;
                }
            }
            return false;
        };

        findAndRefresh(treeData);
    }
  }, [sidebarRefresh]);

  // Funcție care caută nodul în arbore și îi actualizează copiii
  const updateNodeChildren = (nodes, targetId, newChildren, isLoading = false, dbId = null) => {
      return nodes.map(node => {
          if (node.id === targetId) {
              const updatedNode = { ...node, children: newChildren, isLoading, isExpanded: true };
              if (dbId) updatedNode.dbId = dbId;
              return updatedNode;
          }
          if (node.children) {
              return { ...node, children: updateNodeChildren(node.children, targetId, newChildren, isLoading, dbId) };
          }
          return node;
      });
  };

  // Funcție de toggle expand
  const toggleNode = (nodes, targetId) => {
      return nodes.map(node => {
          if (node.id === targetId) {
              return { ...node, isExpanded: !node.isExpanded };
          }
          if (node.children) {
              return { ...node, children: toggleNode(node.children, targetId) };
          }
          return node;
      });
  };

  // Fetch logic
  const fetchSubfolders = async (nodeId, dbParentId) => {
      // Don't set loading on silent refresh if we can avoid UI flicker, 
      // but 'updateNodeChildren' sets isLoading=true. 
      // Maybe we can optimize, but for now standard flow is fine.
      setTreeData(prev => updateNodeChildren(prev, nodeId, [], true));

      let folders = [];
      let currentDbId = dbParentId; // Track the resolved DB ID for root

      try {
          if (nodeId === 'my-drive-root') {
              const rootContents = await driveService.getFolderContents(spaceInfo.id, null);
              const rootFolder = rootContents.find(f => f.name === 'My Drive' && f.type === 'folder');
              
              if (rootFolder) {
                  currentDbId = rootFolder.id; // Capture real ID
                  const realContents = await driveService.getFolderContents(spaceInfo.id, rootFolder.id);
                  folders = realContents.filter(c => c.type === 'folder');
              }
          } else if (nodeId === 'shared-root') {
              const sharedItems = await driveService.getSharedWithMe();
              folders = sharedItems.filter(c => c.type === 'folder');
          } else if (nodeId === 'trash-root') {
              folders = [];
          } else {
              const contents = await driveService.getFolderContents(spaceInfo.id, dbParentId);
              folders = contents.filter(c => c.type === 'folder');
          }
      } catch (err) {
          console.error("Tree fetch error:", err);
      }

      const newChildren = folders.map(f => ({
          id: f.id,
          name: f.name,
          type: 'folder',
          isExpanded: false,
          children: [] 
      }));

      // Pass currentDbId so we can update the root node's dbId state
      setTreeData(prev => updateNodeChildren(prev, nodeId, newChildren, false, currentDbId));
  };

  const handleToggleExpand = (node) => {
      if (!node.isExpanded && (!node.children || node.children.length === 0)) {
          const dbId = (node.id === 'my-drive-root') ? node.dbId : ((node.id === 'shared-root') ? null : node.id);
          if (node.id !== 'trash-root') {
             fetchSubfolders(node.id, dbId);
          }
      } else {
          setTreeData(prev => toggleNode(prev, node.id));
      }
  };
  const handleSelect = (node) => {
      if (node.id === 'my-drive-root') {
          loadFolder('my-drive-entry');
      } else if (node.id === 'shared-root') {
          loadFolder('SHARED_ROOT');
      } else if (node.id === 'trash-root') {
          loadFolder('TRASH_ROOT');
      } else {
          loadFolder(node.id);
      }
  };

  // Storage Bar Calculation
  const used = spaceInfo?.storage_used || 0;
  const limit = spaceInfo?.storage_limit || 1;
  
  // Dynamic formatting
  const formatBytes = (bytes, decimals = 1) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const formattedUsed = formatBytes(used);
  const formattedLimit = formatBytes(limit);

  const rawPercent = (used / limit) * 100;
  const percent = used > 0 ? Math.max(1, Math.min(100, rawPercent)) : 0;

  return (
    <div 
        className="flex flex-col h-full p-4 bg-background border-r border-border"
    >
      {/* ADD NEW BUTTON & MENU */}
      <div className="relative mb-6 z-20">
          <Button 
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-none font-medium"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <Plus className="mr-2 h-4 w-4" /> Add New
          </Button>

          {isMenuOpen && (
              <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
                  <div className="absolute top-full left-0 w-full mt-2 bg-popover rounded-md shadow-xl border border-border py-1 z-20 animate-in fade-in zoom-in-95 duration-100">
                    <button 
                        className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-accent flex items-center gap-2"
                        onClick={handleCreateFolder}
                    >
                        <Folder className="h-4 w-4 text-primary" /> 
                        <span>Folder Nou</span>
                    </button>
                    <button 
                        className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-accent flex items-center gap-2"
                        onClick={handleUploadTrigger}
                    >
                        <UploadCloud className="h-4 w-4 text-green-500" /> 
                        <span>Încarcă Fișier</span>
                    </button>
                  </div>
              </>
          )}
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handleFileChange} 
      />

      {/* TREE VIEW */}
      <div className="flex-1 overflow-y-auto -ml-2"> 
        {treeData.map(node => (
            <TreeNode 
                key={node.id} 
                node={node} 
                activeId={currentFolderId} // Highlight nodul curent
                onSelect={handleSelect}
                onToggleExpand={handleToggleExpand}
            />
        ))}
      </div>

      {/* STORAGE BAR */}
      <div className="mt-auto pt-6 border-t border-border">
        <div className="flex justify-between text-xs mb-1.5">
            <span className="text-muted-foreground font-medium">Storage</span>
            <span className="text-muted-foreground">{rawPercent.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mb-2">
            <div 
                className={`h-full rounded-full transition-all duration-500 ${percent > 90 ? 'bg-destructive' : 'bg-primary'}`} 
                style={{ width: `${percent}%` }}
            ></div>
        </div>
        <div className="text-xs text-muted-foreground">
            {formattedUsed} of {formattedLimit} used
        </div>
      </div>
    </div>
  );
};