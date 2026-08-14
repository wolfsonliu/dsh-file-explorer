import React from 'react';
import { createRoot } from 'react-dom/client';
import { FILE_EXPLORER_ROUTE } from "../protocol.js";
import { registerBuiltinPreviews } from "./preview/index.js";
import { resolvePreview } from "./preview/registry.js";
import { FileExplorerPanel } from "./panel.js";
import { interceptFileLinks } from "./intercept.js";
import { mountSidebar } from "./mount-sidebar.js";
import { SidebarExplorer } from "./sidebar-explorer.js";
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
export function apply(ctx) {
    registerBuiltinPreviews();
    // Inject panel styles (an external plugin cannot import a CSS module).
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-fe-style', '');
    styleEl.textContent = PANEL_CSS;
    document.head.appendChild(styleEl);
    // Floating preview box (overlay panel). It starts closed; the placeholder
    // shows only once a file has been selected and the panel is opened.
    const previewHost = document.createElement('div');
    previewHost.setAttribute('data-fe-preview-host', '');
    document.body.appendChild(previewHost);
    const previewRoot = createRoot(previewHost);
    const previewPanelRef = React.createRef();
    let previewState = null;
    function renderPreview() {
        let children;
        if (previewState) {
            const PreviewComponent = resolvePreview(extensionOf(previewState.path));
            const previewProps = {
                preview: previewState.data,
                filePath: previewState.path,
                activeView: 'preview',
            };
            children = React.createElement(PreviewComponent, previewProps);
        }
        else {
            children = React.createElement('div', { className: 'dsh-fe-placeholder' }, '从文件树选择文件');
        }
        previewRoot.render(React.createElement(FileExplorerPanel, { ref: previewPanelRef, children }));
    }
    renderPreview();
    // Sidebar tab + overlay file tree.
    const sidebarRef = React.createRef();
    let sidebarRoot = null;
    let sidebarTab = 'sessions';
    const fetchList = async (sessionId, path) => {
        try {
            const res = await fetch(`${FILE_EXPLORER_ROUTE}?action=list&sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(path)}`);
            const data = await res.json();
            return data.entries ?? [];
        }
        catch {
            return [];
        }
    };
    async function openFileInPanel(filePath) {
        const sessionId = ctx.sessions.list.getSnapshot().current;
        try {
            if (sessionId) {
                const res = await fetch(`${FILE_EXPLORER_ROUTE}?action=preview&sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(filePath)}`);
                const data = await res.json();
                if (data.ok && data.preview) {
                    previewState = { path: filePath, data: data.preview };
                    renderPreview();
                    previewPanelRef.current?.open();
                }
            }
        }
        catch {
            // ignore preview fetch errors
        }
        sidebarRef.current?.showFiles();
        sidebarTab = 'files';
    }
    function renderSidebar() {
        if (!sidebarRoot)
            return;
        const sessionId = ctx.sessions.list.getSnapshot().current;
        sidebarRoot.render(React.createElement(SidebarExplorer, {
            ref: sidebarRef,
            sessionId,
            fetchList,
            onSelectFile: openFileInPanel,
        }));
    }
    const disposeSidebar = mountSidebar((sidebarHost) => {
        sidebarRoot = createRoot(sidebarHost);
        renderSidebar();
    });
    // Re-render the sidebar when the session list changes (the current session
    // may be selected after this plugin loads, and switching sessions must
    // refresh the tree).
    const unsubscribeSessions = ctx.sessions.list.subscribe(() => {
        renderSidebar();
    });
    // Capture-phase click listener for intercepting file links.
    const handleClick = (event) => {
        interceptFileLinks(event, openFileInPanel);
    };
    document.addEventListener('click', handleClick, true);
    // Keyboard shortcut Ctrl/Cmd+Shift+E toggles the sidebar tab (files ↔ sessions).
    const handleKeydown = (event) => {
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'E') {
            event.preventDefault();
            if (sidebarTab === 'files') {
                sidebarTab = 'sessions';
                sidebarRef.current?.showSessions();
            }
            else {
                sidebarTab = 'files';
                sidebarRef.current?.showFiles();
            }
        }
    };
    document.addEventListener('keydown', handleKeydown);
    ctx.effect(() => {
        return () => {
            unsubscribeSessions();
            document.removeEventListener('click', handleClick, true);
            document.removeEventListener('keydown', handleKeydown);
            previewRoot.unmount();
            sidebarRoot?.unmount();
            previewHost.remove();
            styleEl.remove();
            disposeSidebar();
        };
    }, 'file-explorer: client');
}
