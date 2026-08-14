import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
/** A generic anchored popup menu listing arbitrary items. */
export function FileContextMenu({ open, anchor, items, onClose }) {
    const menuRef = useRef(null);
    // Close on outside pointerdown.
    useEffect(() => {
        if (!open)
            return;
        const handlePointerDown = (e) => {
            // If the click is inside the menu, do nothing.
            if (menuRef.current && menuRef.current.contains(e.target)) {
                return;
            }
            onClose();
        };
        document.addEventListener('pointerdown', handlePointerDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
        };
    }, [open, onClose]);
    if (!open)
        return null;
    return (_jsx("div", { ref: menuRef, className: "dsh-fe-menu", role: "menu", style: {
            position: 'fixed',
            left: `${anchor.x}px`,
            top: `${anchor.y}px`,
        }, children: items.map((item) => (_jsxs("div", { className: "dsh-fe-menu-item", role: "menuitem", onClick: () => {
                item.onSelect();
                onClose();
            }, children: [item.icon, _jsx("span", { children: item.label })] }, item.id))) }));
}
