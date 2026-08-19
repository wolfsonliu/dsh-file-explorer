import React from 'react';
import { createRoot } from 'react-dom/client';
import { FILE_EXPLORER_ROUTE } from "../protocol.js";
import { registerBuiltinPreviews } from "./preview/index.js";
import { registerPreview } from "./preview/registry.js";
import { registerBuiltinFileActions, registerFileAction } from "./file-action.js";
import { FileExplorerApp } from "./app.js";
import { interceptFileLinks } from "./intercept.js";
import { PANEL_CSS } from "./styles.js";
import { FILE_EXPLORER_NS, registerFileExplorerLocale, } from "./locale.js";
export const inject = ['sessions', 'workspaces', 'locale'];
// ---------------------------------------------------------------------------
// apply
// ---------------------------------------------------------------------------
export function apply(ctx) {
    registerBuiltinFileActions();
    // Write UTF-8 text to a workspace file (for preview plugins that edit).
    const writeFile = async (path, content) => {
        const sessionId = ctx.sessions.list.getSnapshot().current;
        if (sessionId === undefined)
            throw new Error('no current session');
        const res = await fetch(`${FILE_EXPLORER_ROUTE}?action=write&sessionId=${encodeURIComponent(sessionId)}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ path, content }),
        });
        const data = await res.json();
        if (!data.ok)
            throw new Error(data.error);
    };
    // Read raw bytes from a workspace file, with optional byte range.
    const readRawFile = async (path, offset, limit) => {
        const sessionId = ctx.sessions.list.getSnapshot().current;
        if (sessionId === undefined)
            throw new Error('no current session');
        const headers = {};
        if (offset !== undefined || limit !== undefined) {
            const start = offset ?? 0;
            const end = limit !== undefined ? start + limit - 1 : '';
            headers['Range'] = `bytes=${start}-${end}`;
        }
        const res = await fetch(`${FILE_EXPLORER_ROUTE}?action=raw&sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(path)}`, { headers });
        if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error((data && data.error) || `raw fetch failed (${res.status})`);
        }
        return res.arrayBuffer();
    };
    registerBuiltinPreviews(readRawFile);
    // Expose the registration services so external plugins can contribute
    // previewers, file-row actions, and file writes (override built-ins by priority).
    ctx.reflect.provide('fileExplorer', { registerPreview, registerFileAction, writeFile, readRawFile });
    // Inject panel styles (an external plugin cannot import a CSS module).
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-fe-style', '');
    styleEl.textContent = PANEL_CSS;
    document.head.appendChild(styleEl);
    // Single React root rendering the floating button, drawer, and preview box.
    const host = document.createElement('div');
    host.setAttribute('data-fe-host', '');
    document.body.appendChild(host);
    const root = createRoot(host);
    const appRef = React.createRef();
    // Register localized copy and bind a stable translator.
    const disposeLocale = registerFileExplorerLocale(ctx);
    const t = ctx.locale.bind(FILE_EXPLORER_NS);
    function render() {
        const sessionId = ctx.sessions.list.getSnapshot().current;
        root.render(React.createElement(FileExplorerApp, {
            ref: appRef,
            sessionId,
            t,
            writeFile,
            readRawFile,
            fetchList: async (sid, path) => {
                try {
                    const res = await fetch(`${FILE_EXPLORER_ROUTE}?action=list&sessionId=${encodeURIComponent(sid)}&path=${encodeURIComponent(path)}`);
                    const data = await res.json();
                    return data.entries ?? [];
                }
                catch {
                    return [];
                }
            },
            fetchPreview: async (sid, path, mode) => {
                try {
                    const modeParam = mode && mode !== 'auto' ? `&mode=${encodeURIComponent(mode)}` : '';
                    const res = await fetch(`${FILE_EXPLORER_ROUTE}?action=preview&sessionId=${encodeURIComponent(sid)}&path=${encodeURIComponent(path)}${modeParam}`);
                    const data = await res.json();
                    return data.preview ?? null;
                }
                catch {
                    return null;
                }
            },
        }));
    }
    render();
    const unsubscribeSessions = ctx.sessions.list.subscribe(() => {
        render();
    });
    const unsubscribeLocale = ctx.locale.subscribe(() => {
        render();
    });
    // Capture-phase click listener for intercepting file links.
    const handleClick = (event) => {
        interceptFileLinks(event, (path) => {
            appRef.current?.openFile(path);
        });
    };
    document.addEventListener('click', handleClick, true);
    // Keyboard shortcut Ctrl/Cmd+Shift+E toggles the drawer.
    const handleKeydown = (event) => {
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'E') {
            event.preventDefault();
            appRef.current?.toggleDrawer();
        }
    };
    document.addEventListener('keydown', handleKeydown);
    ctx.effect(() => {
        return () => {
            disposeLocale();
            unsubscribeSessions();
            unsubscribeLocale();
            document.removeEventListener('click', handleClick, true);
            document.removeEventListener('keydown', handleKeydown);
            root.unmount();
            host.remove();
            styleEl.remove();
        };
    }, 'file-explorer: client');
}
