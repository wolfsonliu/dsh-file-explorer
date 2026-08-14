import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useCallback, useImperativeHandle, useRef, useState, } from 'react';
import { FileExplorerDrawer, FloatingFileButton } from "./drawer.js";
import { FileTree } from "./file-tree.js";
import { FileExplorerPanel } from "./panel.js";
import { resolvePreview } from "./preview/registry.js";
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
export const FileExplorerApp = forwardRef(function FileExplorerApp({ sessionId, fetchList, fetchPreview }, ref) {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedPath, setSelectedPath] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const previewPanelRef = useRef(null);
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
        previewChildren = _jsx("div", { className: "dsh-fe-placeholder", children: "\u4ECE\u6587\u4EF6\u6811\u9009\u62E9\u6587\u4EF6" });
    }
    else {
        const PreviewComponent = resolvePreview(extensionOf(selectedPath ?? ''));
        const previewProps = {
            preview: previewData,
            filePath: selectedPath ?? '',
            activeView: 'preview',
        };
        previewChildren = _jsx(PreviewComponent, { ...previewProps });
    }
    return (_jsxs(_Fragment, { children: [_jsx(FloatingFileButton, { onClick: toggleDrawer }), _jsx(FileExplorerDrawer, { open: drawerOpen, onClose: closeDrawer, children: _jsx(FileTree, { sessionId: sessionId, fetchList: fetchList, onSelectFile: (path) => openFile(path) }) }), _jsx(FileExplorerPanel, { ref: previewPanelRef, title: "\u6587\u4EF6\u9884\u89C8", children: previewChildren })] }));
});
