import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useCallback, useImperativeHandle, useRef, useState, } from 'react';
import { FILE_EXPLORER_ROUTE, PDF_ACTION } from "../protocol.js";
import { FileExplorerDrawer, FloatingFileButton } from "./drawer.js";
import { FileTree } from "./file-tree.js";
import { FileExplorerPanel } from "./panel.js";
import { BinaryPreview, MarkdownPreview, resolvePreviewFor, TextPreview } from "./preview/index.js";
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
/** Whether a path is a PDF (case-insensitive extension). */
function isPdfPath(filePath) {
    return extensionOf(filePath).toLowerCase() === 'pdf';
}
/**
 * Open a PDF in a new browser tab via the inline `pdf` action. Returns false
 * when the tab was blocked (so the caller can fall back to the preview panel).
 */
function openPdfInNewTab(sessionId, path) {
    if (sessionId === undefined)
        return false;
    const url = `${FILE_EXPLORER_ROUTE}?action=${PDF_ACTION}` +
        `&sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(path)}`;
    const win = window.open(url, '_blank');
    if (win === null)
        return false;
    win.opener = null;
    return true;
}
// ---------------------------------------------------------------------------
// FileExplorerApp
// ---------------------------------------------------------------------------
/** Composes the floating button, left drawer, and floating preview box. */
export const FileExplorerApp = forwardRef(function FileExplorerApp({ sessionId, fetchList, fetchPreview, t, writeFile }, ref) {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedPath, setSelectedPath] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [viewMode, setViewMode] = useState('auto');
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [dirty, setDirty] = useState(false);
    const previewPanelRef = useRef(null);
    const treeRef = useRef(null);
    const selectedPathRef = useRef(null);
    const saveRef = useRef(null);
    const openDrawer = useCallback(() => setDrawerOpen(true), []);
    const closeDrawer = useCallback(() => setDrawerOpen(false), []);
    const toggleDrawer = useCallback(() => setDrawerOpen((prev) => !prev), []);
    const startEditing = useCallback(() => {
        if (previewData?.kind !== 'text')
            return;
        setDraft(previewData.content);
        setEditing(true);
        setDirty(false);
        setSaveError(null);
    }, [previewData]);
    const cancelEditing = useCallback(() => {
        setEditing(false);
        setSaving(false);
        setSaveError(null);
        setDirty(false);
    }, []);
    const saveDraft = useCallback(() => {
        if (writeFile === undefined || selectedPath === null)
            return Promise.resolve();
        const targetPath = selectedPath;
        if (saveRef.current !== null && saveRef.current.path === targetPath) {
            return saveRef.current.promise;
        }
        setSaving(true);
        setSaveError(null);
        const promise = (async () => {
            try {
                await writeFile(targetPath, draft);
                if (selectedPathRef.current === targetPath) {
                    setPreviewData((prev) => (prev && prev.kind === 'text' ? { ...prev, content: draft } : prev));
                    setDirty(false);
                }
            }
            catch (error) {
                if (selectedPathRef.current === targetPath) {
                    setDirty(true);
                    setSaveError(error instanceof Error ? error.message : String(error));
                }
                throw error;
            }
            finally {
                if (saveRef.current !== null && saveRef.current.path === targetPath) {
                    saveRef.current = null;
                    setSaving(false);
                }
            }
        })();
        saveRef.current = { path: targetPath, promise };
        return promise;
    }, [writeFile, selectedPath, draft]);
    const handleSave = useCallback(() => {
        void saveDraft().catch(() => { });
    }, [saveDraft]);
    const previewEditing = useCallback(async () => {
        const targetPath = selectedPath;
        try {
            await saveDraft();
        }
        catch {
            return;
        }
        if (selectedPathRef.current === targetPath)
            setEditing(false);
    }, [saveDraft, selectedPath]);
    const handlePanelClose = useCallback(() => {
        if (editing && dirty && writeFile !== undefined) {
            void saveDraft().catch(() => { });
        }
        // The edit session ends when the panel closes, regardless of save outcome.
        setEditing(false);
        setDirty(false);
        setSaving(false);
        setDraft('');
        setSaveError(null);
    }, [editing, dirty, writeFile, saveDraft]);
    const openFileWithMode = useCallback(async (path, mode) => {
        // PDF default-open goes straight to a new browser tab (before any
        // `await`, so the call stays inside the click gesture). When the tab
        // is blocked, fall through to the normal panel preview.
        if (mode === 'auto' && isPdfPath(path) && openPdfInNewTab(sessionId, path))
            return;
        if (editing && dirty && writeFile !== undefined) {
            try {
                await saveDraft();
            }
            catch {
                return; // 保存失败：停留在当前文件，不切换
            }
        }
        setEditing(false);
        setDirty(false);
        setSaving(false);
        setSaveError(null);
        setDraft('');
        selectedPathRef.current = path;
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
    }, [sessionId, fetchPreview, editing, dirty, writeFile, saveDraft]);
    const openFile = useCallback((path) => { void openFileWithMode(path, 'auto'); }, [openFileWithMode]);
    const openFileAsText = useCallback((path) => { void openFileWithMode(path, 'text'); }, [openFileWithMode]);
    const openFileAsBinary = useCallback((path) => { void openFileWithMode(path, 'binary'); }, [openFileWithMode]);
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
    // Built-in markdown editing only: a plugin overriding 'md' resolves to a
    // different component, so the edit affordance is hidden in that case.
    const isEditableMarkdown = writeFile !== undefined &&
        viewMode === 'auto' &&
        previewData !== null &&
        previewData.kind === 'text' &&
        resolvePreviewFor(previewData, extensionOf(selectedPath ?? '')) === MarkdownPreview;
    let previewChildren;
    if (previewData === null) {
        previewChildren = _jsx("div", { className: "dsh-fe-placeholder", children: t('selectFile') });
    }
    else if (isEditableMarkdown) {
        previewChildren = (_jsxs("div", { className: "dsh-fe-md", children: [_jsx("div", { className: "dsh-fe-md-toolbar", children: editing ? (_jsxs(_Fragment, { children: [_jsx("button", { className: "dsh-fe-md-btn", "data-fe-edit": "cancel", onClick: cancelEditing, disabled: saving, children: t('cancel') }), _jsx("button", { className: "dsh-fe-md-btn", "data-fe-edit": "save", onClick: handleSave, disabled: saving, children: saving ? t('saving') : t('save') }), _jsx("button", { className: "dsh-fe-md-btn", "data-fe-edit": "preview", onClick: () => { void previewEditing(); }, disabled: saving, children: t('mdPreview') })] })) : (_jsx("button", { className: "dsh-fe-md-btn", "data-fe-edit": "edit", onClick: startEditing, children: t('edit') })) }), saveError !== null && (_jsxs("div", { className: "dsh-fe-md-error", children: [t('saveFailed'), ": ", saveError] })), editing ? (_jsx("textarea", { className: "dsh-fe-md-editor", "data-fe-edit": "textarea", value: draft, disabled: saving, onChange: (e) => {
                        setDraft(e.target.value);
                        setDirty(true);
                    } })) : (_jsx(MarkdownPreview, { preview: previewData, filePath: selectedPath ?? '', activeView: "preview", t: t }))] }));
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
    return (_jsxs(_Fragment, { children: [_jsx(FloatingFileButton, { onClick: toggleDrawer, t: t }), _jsx(FileExplorerDrawer, { open: drawerOpen, onClose: closeDrawer, onRefresh: () => treeRef.current?.refresh(), t: t, children: _jsx(FileTree, { ref: treeRef, sessionId: sessionId, fetchList: fetchList, helpers: helpers, t: t }) }), _jsx(FileExplorerPanel, { ref: previewPanelRef, title: panelTitle, onClose: handlePanelClose, t: t, children: previewChildren })] }));
});
