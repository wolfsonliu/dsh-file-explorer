import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef } from 'react';
export function FileContextMenu({ x, y, open, path, relativePath, t, onOpen, onCopyPath, onCopyRelativePath, onClose, }) {
    const menuRef = useRef(null);
    // Close on outside pointerdown
    useEffect(() => {
        if (!open)
            return;
        const handlePointerDown = (e) => {
            // If the click is inside the menu, do nothing
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
    const handleOpen = useCallback(() => {
        onOpen();
        onClose();
    }, [onOpen, onClose]);
    const handleCopyPath = useCallback(() => {
        navigator.clipboard.writeText(path).then(() => {
            onCopyPath();
            onClose();
        });
    }, [path, onCopyPath, onClose]);
    const handleCopyRelativePath = useCallback(() => {
        navigator.clipboard.writeText(relativePath).then(() => {
            onCopyRelativePath();
            onClose();
        });
    }, [relativePath, onCopyRelativePath, onClose]);
    if (!open)
        return null;
    return (_jsxs("div", { ref: menuRef, className: "dsh-fe-context-menu", role: "menu", style: {
            position: 'fixed',
            left: `${x}px`,
            top: `${y}px`,
        }, children: [_jsx("div", { className: "dsh-fe-context-menu-item", role: "menuitem", onClick: handleOpen, children: t('open') }), _jsx("div", { className: "dsh-fe-context-menu-item", role: "menuitem", onClick: handleCopyPath, children: t('copyPath') }), _jsx("div", { className: "dsh-fe-context-menu-item", role: "menuitem", onClick: handleCopyRelativePath, children: t('copyRelativePath') })] }));
}
