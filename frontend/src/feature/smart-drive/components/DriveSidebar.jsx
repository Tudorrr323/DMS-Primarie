import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronDown, Folder, HardDrive, Users, Plus, Loader2 } from 'lucide-react';
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

  return (
    <div className="flex flex-col select-none">
      <div 
        className={`flex items-center gap-2 py-1.5 pr-2 text-sm rounded-r-md cursor-pointer transition-colors border-l-2 ${
          isActive 
            ? 'bg-blue-50 text-blue-600 border-blue-500' 
            : 'text-slate-600 hover:bg-slate-50 border-transparent'
        }`}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={(e) => {
            e.stopPropagation();
            onSelect(node);
        }}
      >
        {/* Toggle Button */}
        <div 
          className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600 z-10"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(node);
          }}
        >
          {/* Arătăm săgeata doar dacă nu e Shared Root (care e plat de obicei) sau dacă știm că are copii */}
          {(node.id === 'my-drive-root' || node.type === 'folder') && (
             isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          )}
        </div>
        
        <Icon size={16} className={isActive ? "text-blue-500" : "text-slate-400"} />
        <span className="font-medium truncate">{node.name}</span>
      </div>

      {/* Render Children */}
      {isExpanded && node.children && (
        <div className="flex flex-col">
            {node.isLoading ? (
                <div className="pl-8 py-1 text-xs text-slate-400 flex items-center">
                    <Loader2 size={10} className="animate-spin mr-2" /> Loading...
                </div>
            ) : node.children.length === 0 ? (
                <div className="pl-8 py-1 text-xs text-slate-400 italic">Empty</div>
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
  const { spaceInfo, currentFolderId, loadFolder } = useDriveStore();
  
  // Starea arborelui (ierarhică)
  // Inițializăm cu cele două rădăcini
  const [treeData, setTreeData] = useState([
      { id: 'my-drive-root', name: 'My Drive', type: 'root', isExpanded: true, children: [] },
      { id: 'shared-root', name: 'Shared with Me', type: 'root', isExpanded: false, children: [] }
  ]);

  // Inițializare: Încărcăm My Drive la prima randare dacă avem spaceInfo
  useEffect(() => {
      if (spaceInfo?.id) {
          fetchSubfolders('my-drive-root', null);
      }
  }, [spaceInfo?.id]);

  // Funcție care caută nodul în arbore și îi actualizează copiii
  const updateNodeChildren = (nodes, targetId, newChildren, isLoading = false) => {
      return nodes.map(node => {
          if (node.id === targetId) {
              return { ...node, children: newChildren, isLoading, isExpanded: true };
          }
          if (node.children) {
              return { ...node, children: updateNodeChildren(node.children, targetId, newChildren, isLoading) };
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
      // Set loading state
      setTreeData(prev => updateNodeChildren(prev, nodeId, [], true));

      let folders = [];
      try {
          if (nodeId === 'my-drive-root') {
              // CAZ SPECIAL: Vrem copiii folderului rădăcină "My Drive", nu folderul în sine
              // 1. Găsim ID-ul folderului "My Drive" (root)
              const rootContents = await driveService.getFolderContents(spaceInfo.id, null);
              const rootFolder = rootContents.find(f => f.name === 'My Drive' && f.type === 'folder');
              
              if (rootFolder) {
                  // 2. Luăm conținutul LUI
                  const realContents = await driveService.getFolderContents(spaceInfo.id, rootFolder.id);
                  folders = realContents.filter(c => c.type === 'folder');
              } else {
                  // Fallback dacă nu există folderul My Drive (ciudat, dar posibil)
                  folders = []; 
              }
          } else if (nodeId === 'shared-root') {
              const sharedItems = await driveService.getSharedWithMe();
              folders = sharedItems.filter(c => c.type === 'folder');
          } else {
              // Subfolder normal
              const contents = await driveService.getFolderContents(spaceInfo.id, dbParentId);
              folders = contents.filter(c => c.type === 'folder');
          }
      } catch (err) {
          console.error("Tree fetch error:", err);
      }

      // Convertim la formatul TreeNode
      const newChildren = folders.map(f => ({
          id: f.id,
          name: f.name,
          type: 'folder',
          isExpanded: false,
          children: [] // Copiii vor fi încărcați la cerere (lazy)
      }));

      setTreeData(prev => updateNodeChildren(prev, nodeId, newChildren, false));
  };

  const handleToggleExpand = (node) => {
      // Dacă nodul nu e expandat și nu are copii încărcați (și nu e empty explicit), încercăm să încărcăm
      if (!node.isExpanded && (!node.children || node.children.length === 0)) {
          const dbId = (node.id === 'my-drive-root' || node.id === 'shared-root') ? null : node.id;
          fetchSubfolders(node.id, dbId);
      } else {
          // Doar toggle vizual
          setTreeData(prev => toggleNode(prev, node.id));
      }
  };

  const handleSelect = (node) => {
      // Navigare în Store (partea dreaptă)
      if (node.id === 'my-drive-root') {
          loadFolder('my-drive-entry');
      } else if (node.id === 'shared-root') {
          loadFolder('SHARED_ROOT');
      } else {
          loadFolder(node.id);
      }
  };

  // Storage Bar Calculation
  const used = spaceInfo?.storage_used || 0;
  const limit = spaceInfo?.storage_limit || 1;
  const percent = Math.min(100, (used / limit) * 100);
  const toGB = (bytes) => (bytes / (1024 * 1024 * 1024)).toFixed(1);

  return (
    <div className="flex flex-col h-full p-4 bg-white border-r border-slate-200">
      {/* ADD NEW BUTTON */}
      <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white shadow-none font-medium mb-6">
        <Plus className="mr-2 h-4 w-4" /> Add New
      </Button>

      {/* TREE VIEW */}
      <div className="flex-1 overflow-y-auto -ml-2"> 
        {/* -ml-2 ca să compensăm padding-ul nodurilor pt look aliniat */}
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
      <div className="mt-auto pt-6 border-t border-slate-50">
        <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-500 font-medium">Storage</span>
            <span className="text-slate-400">{Math.round(percent)}%</span>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
            <div 
                className={`h-full rounded-full transition-all duration-500 ${percent > 90 ? 'bg-red-500' : 'bg-blue-500'}`} 
                style={{ width: `${percent}%` }}
            ></div>
        </div>
        <div className="text-xs text-slate-400">
            {toGB(used)} GB of {toGB(limit)} GB used
        </div>
      </div>
    </div>
  );
};
