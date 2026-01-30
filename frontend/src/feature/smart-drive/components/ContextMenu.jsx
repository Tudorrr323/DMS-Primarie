import React, { useEffect, useRef } from 'react';

export const ContextMenu = ({ x, y, onClose, items }) => {
  const menuRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };
    // Close on Scroll (to avoid floating menu detached)
    const handleScroll = () => onClose();

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  if (!items || items.length === 0) return null;

  // Adjust position if close to screen edge (Basic)
  const style = { top: y, left: x };
  if (window.innerHeight - y < 200) style.top = y - 200; // Flip up if at bottom

  return (
    <div 
      ref={menuRef}
      className="fixed z-50 w-56 bg-white rounded-lg shadow-xl border border-slate-200 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
      style={style}
      onContextMenu={(e) => e.preventDefault()} // Prevent native menu on custom menu
    >
      {items.map((item, index) => (
        item.separator ? (
            <div key={index} className="h-px bg-slate-100 my-1" />
        ) : (
            <button
            key={index}
            className={`w-full px-4 py-2 text-sm text-left flex items-center gap-2 hover:bg-slate-50 transition-colors ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700'}`}
            onClick={(e) => {
                e.stopPropagation();
                item.action();
                onClose();
            }}
            >
            {item.icon && <item.icon className="h-4 w-4 opacity-70" />}
            {item.label}
            </button>
        )
      ))}
    </div>
  );
};
