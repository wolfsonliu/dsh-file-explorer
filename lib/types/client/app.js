import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useCallback, useImperativeHandle, useRef, useState, } from 'react';
import { FileExplorerDrawer, FloatingFileButton } from "./drawer.js";
import { FileTree } from "./file-tree.js";
import { FileExplorerPanel } from "./panel.js";
import { resolvePreviewFor } from "./preview/index.js";
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
// ---------------------------------------------------------------------------
// FileExplorerApp
// ---------------------------------------------------------------------------
/** Composes the floating button, left drawer, and floating preview box. */
export const FileExplorerApp = forwardRef(function FileExplorerApp({ sessionId, fetchList, fetchPreview, t }, ref) {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedPath, setSelectedPath] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const previewPanelRef = useRef(null);
    const treeRef = useRef(null);
    const openDrawer = useCallback(() => setDrawerOpen(true), []);
    const closeDrawer = useCallback(() => setDrawerOpen(false), []);
    const toggleDrawer = useCallback(() => setDrawerOpen((prev) => !prev), []);
    const openFile = useCallback((path) => {
        setSelectedPath(path);
        if (sessionId === undefined)
            return;
        void fetchPreview(sessionId, path)
            .then((preview) => {
            setPreviewData(preview);
            setDrawerOpen(true);
            previewPanelRef.current?.open();
        })
            .catch(() => {
            // Ignore preview fetch failures.
        });
    }, [sessionId, fetchPreview]);
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
        const PreviewComponent = resolvePreviewFor(previewData, extensionOf(selectedPath ?? ''));
        const previewProps = {
            preview: previewData,
            filePath: selectedPath ?? '',
            activeView: 'preview',
            t,
        };
        previewChildren = _jsx(PreviewComponent, { ...previewProps });
    }
    return (_jsxs(_Fragment, { children: [_jsx(FloatingFileButton, { onClick: toggleDrawer, t: t }), _jsx(FileExplorerDrawer, { open: drawerOpen, onClose: closeDrawer, onRefresh: () => treeRef.current?.refresh(), t: t, children: _jsx(FileTree, { ref: treeRef, sessionId: sessionId, fetchList: fetchList, onSelectFile: (path) => openFile(path), t: t }) }), _jsx(FileExplorerPanel, { ref: previewPanelRef, t: t, children: previewChildren })] }));
});
