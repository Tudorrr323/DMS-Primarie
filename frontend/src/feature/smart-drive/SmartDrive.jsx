import React, { useState } from 'react';
import { DriveHeader } from './components/DriveHeader';
import { DriveSidebar } from './components/DriveSidebar';
import { DriveExplorer } from './components/DriveExplorer';
import { DriveBreadcrumb } from './components/DriveBreadcrumb';
import { useDriveStore } from './store/useDriveStore';

export const SmartDrive = () => {
  const { currentFolderId, items, spaceInfo } = useDriveStore();
  
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-700">
      {/* LEFT SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <DriveSidebar />
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* HEADER */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
           <DriveHeader />
        </header>

        {/* CONTENT SCROLLABLE */}
        <div className="flex-1 overflow-auto p-6">
           <div className="bg-transparent mb-4 flex items-center gap-2">
              {/* Refresh icon */}
              <button className="text-slate-400 hover:text-slate-600">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
              </button>
              {/* Breadcrumbs integrate */}
              <DriveBreadcrumb />
           </div>

           {/* Explorer Grid */}
           <DriveExplorer />
        </div>
      </main>
    </div>
  );
};

export default SmartDrive;