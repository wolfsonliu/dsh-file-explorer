import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useCallback, useImperativeHandle, useRef, useState, } from 'react';
import { FILE_EXPLORER_ROUTE } from "../protocol.js";
import { FileExplorerDrawer, FloatingFileButton } from "./drawer.js";
import { FileTree } from "./file-tree.js";
import { FileExplorerPanel } from "./panel.js";
import { BinaryPreview, resolvePreviewFor, TextPreview } from "./preview/index.js";
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Extract the file extension (no leading dot); '' when absent. */
function extensionOf(filePath) {
    const lastDot = filePath.lastIndexOf('.');
    if (lastDot === -1 || lastDot === filePath.length - 1)
        return '';
    return filePath.slice(lastDot + 1);
}
/** Extract the basename (last path segment) of a workspace-relative path. */
function basenameOf(filePath) {
    return filePath.split('/').at(-1) ?? filePath;
}
// ---------------------------------------------------------------------------
// FileExplorerApp
// ---------------------------------------------------------------------------
/** Composes the floating button, left drawer, and floating preview box. */
export const FileExplorerApp = forwardRef(function FileExplorerApp({ sessionId, fetchList, fetchPreview, t }, ref) {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedPath, setSelectedPath] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [viewMode, setViewMode] = useState('auto');
    const previewPanelRef = useRef(null);
    const treeRef = useRef(null);
    const openDrawer = useCallback(() => setDrawerOpen(true), []);
    const closeDrawer = useCallback(() => setDrawerOpen(false), []);
    const toggleDrawer = useCallback(() => setDrawerOpen((prev) => !prev), []);
    const openFileWithMode = useCallback((path, mode) => {
        setSelectedPath(path);
        setViewMode(mode);
        if (sessionId === undefined)
            return;
        const request = mode === 'auto'
            ? fetchPreview(sessionId, path)
            : fetchPreview(sessionId, path, mode);
        void request
            .then((preview) => {
            setPreviewData(preview);
            setDrawerOpen(true);
            previewPanelRef.current?.open();
        })
            .catch(() => {
            // Ignore preview fetch failures.
        });
    }, [sessionId, fetchPreview]);
    const openFile = useCallback((path) => openFileWithMode(path, 'auto'), [openFileWithMode]);
    const openFileAsText = useCallback((path) => openFileWithMode(path, 'text'), [openFileWithMode]);
    const openFileAsBinary = useCallback((path) => openFileWithMode(path, 'binary'), [openFileWithMode]);
    const copyAbsolutePath = useCallback(async (path) => {
        if (sessionId === undefined)
            return;
        try {
            const res = await fetch(`${FILE_EXPLORER_ROUTE}?action=resolve-path&sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(path)}`);
            const data = await res.json();
            await navigator.clipboard.writeText(data.path);
        }
        catch {
            // Ignore resolve-path / clipboard failures.
        }
    }, [sessionId]);
    const copyRelativePath = useCallback(async (path) => {
        await navigator.clipboard.writeText(path);
    }, []);
    const helpers = { openFile, openFileAsText, openFileAsBinary, copyAbsolutePath, copyRelativePath };
    useImperativeHandle(ref, () => ({
        openDrawer,
        closeDrawer,
        toggleDrawer,
        openFile,
    }), [openDrawer, closeDrawer, toggleDrawer, openFile]);
    let previewChildren;
    if (previewData === null) {
        previewChildren = _jsx("div", { className: "dsh-fe-placeholder", children: t('selectFile') });
    }
    else {
        const PreviewComponent = viewMode === 'text'
            ? TextPreview
            : viewMode === 'binary'
                ? BinaryPreview
                : resolvePreviewFor(previewData, extensionOf(selectedPath ?? ''));
        const previewProps = {
            preview: previewData,
            filePath: selectedPath ?? '',
            activeView: 'preview',
            t,
        };
        previewChildren = _jsx(PreviewComponent, { ...previewProps });
    }
    const panelTitle = previewData?.name ?? (selectedPath ? basenameOf(selectedPath) : undefined);
    return (_jsxs(_Fragment, { children: [_jsx(FloatingFileButton, { onClick: toggleDrawer, t: t }), _jsx(FileExplorerDrawer, { open: drawerOpen, onClose: closeDrawer, onRefresh: () => treeRef.current?.refresh(), t: t, children: _jsx(FileTree, { ref: treeRef, sessionId: sessionId, fetchList: fetchList, helpers: helpers, t: t }) }), _jsx(FileExplorerPanel, { ref: previewPanelRef, title: panelTitle, t: t, children: previewChildren })] }));
});
