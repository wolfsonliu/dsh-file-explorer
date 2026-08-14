import React, { useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FILE_EXPLORER_ROUTE } from "../protocol.js";
import { registerBuiltinPreviews } from "./preview/index.js";
import { resolvePreview } from "./preview/registry.js";
import { FileExplorerPanel } from "./panel.js";
import { FileTree } from "./file-tree.js";
import { FileContextMenu } from "./context-menu.js";
import { interceptFileLinks } from "./intercept.js";
import { PANEL_CSS } from "./styles.js";
export const inject = ['sessions', 'workspaces'];
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function extensionOf(filePath) {
    const lastDot = filePath.lastIndexOf('.');
    if (lastDot === -1 || lastDot === filePath.length - 1)
        return '';
    return filePath.slice(lastDot + 1);
}
export function FileExplorerApp({ sessionId, panelRef }) {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const fetchList = useCallback(async (sid, path) => {
        try {
            const res = await fetch(`${FILE_EXPLORER_ROUTE}?action=list&sessionId=${encodeURIComponent(sid)}&path=${encodeURIComponent(path)}`);
            const data = await res.json();
            return data.entries ?? [];
        }
        catch {
            return [];
        }
    }, []);
    const handleSelectFile = useCallback(async (filePath) => {
        setSelectedFile(filePath);
        if (!sessionId)
            return;
        try {
            const res = await fetch(`${FILE_EXPLORER_ROUTE}?action=preview&sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(filePath)}`);
            const data = await res.json();
            if (data.ok && data.preview) {
                setPreviewData(data.preview);
            }
        }
        catch {
            // ignore preview fetch errors
        }
    }, [sessionId]);
    const handleContextMenu = useCallback((entry, x, y) => {
        // Compute relativePath: strip leading slash if any
        const relativePath = entry.path.startsWith('/') ? entry.path.slice(1) : entry.path;
        setContextMenu({
            x,
            y,
            open: true,
            path: entry.path,
            relativePath,
        });
    }, []);
    const handleCloseContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);
    const handleOpenFromContext = useCallback(() => {
        if (contextMenu) {
            handleSelectFile(contextMenu.path);
        }
    }, [contextMenu, handleSelectFile]);
    const handleCopyPath = useCallback(() => {
        // actual copy is handled by FileContextMenu via navigator.clipboard
    }, []);
    const handleCopyRelativePath = useCallback(() => {
        // actual copy is handled by FileContextMenu via navigator.clipboard
    }, []);
    // Build preview element
    let previewElement;
    if (selectedFile && previewData) {
        const ext = extensionOf(selectedFile);
        const PreviewComponent = resolvePreview(ext);
        const previewProps = {
            preview: previewData,
            filePath: selectedFile,
            activeView: 'preview',
        };
        previewElement = React.createElement(PreviewComponent, previewProps);
    }
    else {
        previewElement = React.createElement('div', { className: 'dsh-fe-placeholder' }, '从文件树选择文件');
    }
    return React.createElement(React.Fragment, null, React.createElement(FileExplorerPanel, {
        ref: panelRef,
        tree: React.createElement(FileTree, {
            sessionId,
            fetchList,
            onSelectFile: handleSelectFile,
            onContextMenu: handleContextMenu,
        }),
        preview: previewElement,
    }), contextMenu &&
        React.createElement(FileContextMenu, {
            ...contextMenu,
            onOpen: handleOpenFromContext,
            onCopyPath: handleCopyPath,
            onCopyRelativePath: handleCopyRelativePath,
            onClose: handleCloseContextMenu,
        }));
}
// ---------------------------------------------------------------------------
// apply
// ---------------------------------------------------------------------------
export function apply(ctx) {
    registerBuiltinPreviews();
    // Inject panel styles (an external plugin cannot import a CSS module).
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-fe-style', '');
    styleEl.textContent = PANEL_CSS;
    document.head.appendChild(styleEl);
    const host = document.createElement('div');
    host.setAttribute('data-fe-host', '');
    document.body.appendChild(host);
    const root = createRoot(host);
    const panelRef = React.createRef();
    function render() {
        const sessionId = ctx.sessions.list.getSnapshot().current;
        root.render(React.createElement(FileExplorerApp, { sessionId, panelRef }));
    }
    render();
    // Re-render when the session list changes (the current session may be
    // selected after this plugin loads, and switching sessions must refresh
    // the tree).
    const unsubscribeSessions = ctx.sessions.list.subscribe(() => {
        render();
    });
    // openFileInPanel: open the panel and trigger a preview fetch
    function openFileInPanel(filePath) {
        panelRef.current?.open();
        const sessionId = ctx.sessions.list.getSnapshot().current;
        if (sessionId) {
            fetch(`${FILE_EXPLORER_ROUTE}?action=preview&sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(filePath)}`).catch(() => {
                // ignore fetch errors
            });
        }
    }
    // Capture-phase click listener for intercepting file links
    const handleClick = (event) => {
        interceptFileLinks(event, openFileInPanel);
    };
    document.addEventListener('click', handleClick, true);
    // Keydown listener for Ctrl/Cmd+Shift+E toggle
    const handleKeydown = (event) => {
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'E') {
            event.preventDefault();
            panelRef.current?.toggle();
        }
    };
    document.addEventListener('keydown', handleKeydown);
    ctx.effect(() => {
        return () => {
            unsubscribeSessions();
            document.removeEventListener('click', handleClick, true);
            document.removeEventListener('keydown', handleKeydown);
            root.unmount();
            host.remove();
            styleEl.remove();
        };
    }, 'file-explorer: client');
}
