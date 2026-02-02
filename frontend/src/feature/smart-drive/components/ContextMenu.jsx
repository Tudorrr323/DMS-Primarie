import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';

export const ContextMenu = ({ x, y, onClose, items }) => {
  const menuRef = useRef(null);
  const [position, setPosition] = useState({ top: y, left: x });
  const [isVisible, setIsVisible] = useState(false);

  useLayoutEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      let finalX = x;
      let finalY = y;

      if (x + menuRect.width > screenWidth) {
        finalX = screenWidth - menuRect.width - 10;
      }
      if (y + menuRect.height > screenHeight) {
        finalY = screenHeight - menuRect.height - 10;
      }

      finalX = Math.max(10, finalX);
      finalY = Math.max(10, finalY);

      setPosition({ top: finalY, left: finalX });
      setIsVisible(true);
    }
  }, [x, y]);

  useEffect(() => {
    const handleOutsideAction = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    // Ascultăm pe 'mousedown' și 'wheel' pentru a închide meniul corect
    document.addEventListener('mousedown', handleOutsideAction);
    window.addEventListener('wheel', onClose, { passive: true });
    window.addEventListener('resize', onClose);

    return () => {
      document.removeEventListener('mousedown', handleOutsideAction);
      window.removeEventListener('wheel', onClose);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  if (!items || items.length === 0) return null;

  return (
    <div 
      ref={menuRef}
      className="fixed z-50 w-56 bg-popover rounded-lg shadow-xl border border-border py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-75"
      style={{ 
        top: position.top, 
        left: position.left,
        opacity: isVisible ? 1 : 0 
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, index) => (
        item.separator ? (
            <div key={index} className="h-px bg-muted my-1" />
        ) : (
            <button
            key={index}
            className={`w-full px-4 py-2 text-sm text-left flex items-center gap-2 hover:bg-accent transition-colors ${item.danger ? 'text-destructive hover:bg-destructive/10' : 'text-foreground'}`}
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
