import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useCallback, useImperativeHandle, useRef, useState, } from 'react';
import { FILE_EXPLORER_ROUTE, STATIC_FILES_ROUTE, BROWSER_OPEN_EXTS } from "../protocol.js";
import { FileExplorerDrawer, FloatingFileButton } from "./drawer.js";
import { FileTree } from "./file-tree.js";
import { FileExplorerPanel } from "./panel.js";
import { BinaryPreview, MarkdownPreview, TextPreview, makeTextPagedPreview, resolvePreviewFor } from "./preview/index.js";
import { FileOpsModal } from "./file-ops-modal.js";
import { FileContextMenu } from "./context-menu.js";
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
/** Whether a path should be opened in a new browser tab (case-insensitive extension). */
function isBrowserOpenable(filePath) {
    return BROWSER_OPEN_EXTS.includes(extensionOf(filePath).toLowerCase());
}
/**
 * Open a browser-renderable file in a new tab via the static files route.
 * Returns false when the tab was blocked (so the caller falls back to the
 * preview panel).
 */
function openInBrowserTab(sessionId, path) {
    if (sessionId === undefined)
        return false;
    const url = `${STATIC_FILES_ROUTE}/${encodeURIComponent(sessionId)}/` +
        path.split('/').map(encodeURIComponent).join('/');
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
export const FileExplorerApp = forwardRef(function FileExplorerApp({ sessionId, fetchList, fetchPreview, t, writeFile, readRawFile, fileOps }, ref) {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedPath, setSelectedPath] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [viewMode, setViewMode] = useState('auto');
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [dirty, setDirty] = useState(false);
    const [fileOp, setFileOp] = useState({ kind: 'idle' });
    const [newMenu, setNewMenu] = useState({ open: false, getAnchorRect: null });
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
        // Browser-renderable files default-open in a new tab (before any
        // `await`, so the call stays inside the click gesture). When the tab
        // is blocked, fall through to the normal panel preview.
        if (mode === 'auto' && isBrowserOpenable(path) && openInBrowserTab(sessionId, path))
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
    const handleOpDone = useCallback((newPath) => {
        const op = fileOp;
        setFileOp({ kind: 'idle' });
        treeRef.current?.refresh();
        if (op.kind === 'rename' || op.kind === 'move') {
            if (selectedPathRef.current === op.entry.path) {
                selectedPathRef.current = newPath;
                setSelectedPath(newPath);
                if (sessionId !== undefined) {
                    void fetchPreview(sessionId, newPath)
                        .then((preview) => { if (selectedPathRef.current === newPath)
                        setPreviewData(preview); })
                        .catch(() => { });
                }
            }
        }
        else if (op.kind === 'delete') {
            if (selectedPathRef.current === op.entry.path) {
                selectedPathRef.current = null;
                setSelectedPath(null);
                setPreviewData(null);
                setEditing(false);
                setDirty(false);
                setDraft('');
                setSaveError(null);
                setSaving(false);
                previewPanelRef.current?.close();
            }
        }
    }, [fileOp, sessionId, fetchPreview]);
    const handleOpCancel = useCallback(() => { setFileOp({ kind: 'idle' }); }, []);
    const openNewMenu = useCallback((getAnchorRect) => {
        setNewMenu({ open: true, getAnchorRect });
    }, []);
    const promptRename = useCallback((entry) => { setFileOp({ kind: 'rename', entry }); }, []);
    const promptDelete = useCallback((entry) => { setFileOp({ kind: 'delete', entry }); }, []);
    const promptMove = useCallback((entry) => { setFileOp({ kind: 'move', entry }); }, []);
    const promptCopy = useCallback((entry) => { setFileOp({ kind: 'copy', entry }); }, []);
    const promptNewFile = useCallback((parentDir) => { setFileOp({ kind: 'new-file', parentDir }); }, []);
    const promptNewFolder = useCallback((parentDir) => { setFileOp({ kind: 'new-folder', parentDir }); }, []);
    const helpers = { openFile, openFileAsText, openFileAsBinary, copyAbsolutePath, copyRelativePath, promptRename, promptDelete, promptMove, promptCopy, promptNewFile, promptNewFolder };
    useImperativeHandle(ref, () => ({
        openDrawer,
        closeDrawer,
        toggleDrawer,
        openFile,
    }), [openDrawer, closeDrawer, toggleDrawer, openFile]);
    // Resolve the component that renders the current preview exactly once, so
    // the edit-affordance gate and the render branch agree on the same one.
    let resolvedComponent = null;
    if (previewData !== null) {
        resolvedComponent =
            viewMode === 'text'
                ? makeTextPagedPreview(readRawFile)
                : viewMode === 'binary'
                    ? BinaryPreview
                    : resolvePreviewFor(previewData, extensionOf(selectedPath ?? ''), readRawFile);
    }
    // Built-in text editing: show the edit affordance only when the resolved
    // component is a built-in text renderer. A plugin that claims this
    // extension at higher priority resolves to a different component, so the
    // built-in editor is hidden and the extension takes over editing.
    const isMarkdown = resolvedComponent === MarkdownPreview;
    const isEditableText = writeFile !== undefined &&
        viewMode === 'auto' &&
        previewData !== null &&
        previewData.kind === 'text' &&
        (resolvedComponent === TextPreview ||
            resolvedComponent === makeTextPagedPreview(readRawFile) ||
            isMarkdown);
    let previewChildren;
    if (previewData === null) {
        previewChildren = _jsx("div", { className: "dsh-fe-placeholder", children: t('selectFile') });
    }
    else {
        const PreviewComponent = resolvedComponent;
        if (isEditableText) {
            previewChildren = (_jsxs("div", { className: "dsh-fe-md", children: [_jsx("div", { className: "dsh-fe-md-toolbar", children: editing ? (_jsxs(_Fragment, { children: [_jsx("button", { className: "dsh-fe-md-btn", "data-fe-edit": "cancel", onClick: cancelEditing, disabled: saving, children: t('cancel') }), _jsx("button", { className: "dsh-fe-md-btn", "data-fe-edit": "save", onClick: handleSave, disabled: saving, children: saving ? t('saving') : t('save') }), isMarkdown && (_jsx("button", { className: "dsh-fe-md-btn", "data-fe-edit": "preview", onClick: () => { void previewEditing(); }, disabled: saving, children: t('mdPreview') }))] })) : (_jsx("button", { className: "dsh-fe-md-btn", "data-fe-edit": "edit", onClick: startEditing, children: t('edit') })) }), saveError !== null && (_jsxs("div", { className: "dsh-fe-md-error", children: [t('saveFailed'), ": ", saveError] })), editing ? (_jsx("textarea", { className: "dsh-fe-md-editor", "data-fe-edit": "textarea", value: draft, disabled: saving, onChange: (e) => {
                            setDraft(e.target.value);
                            setDirty(true);
                        } })) : (_jsx(PreviewComponent, { preview: previewData, filePath: selectedPath ?? '', activeView: "preview", t: t }))] }));
        }
        else {
            previewChildren = (_jsx(PreviewComponent, { preview: previewData, filePath: selectedPath ?? '', activeView: "preview", t: t }));
        }
    }
    const panelTitle = previewData?.name ?? (selectedPath ? basenameOf(selectedPath) : undefined);
    return (_jsxs(_Fragment, { children: [_jsx(FloatingFileButton, { onClick: toggleDrawer, t: t, open: drawerOpen }), _jsx(FileExplorerDrawer, { open: drawerOpen, onClose: closeDrawer, onRefresh: () => treeRef.current?.refresh(), onNew: openNewMenu, t: t, children: _jsx(FileTree, { ref: treeRef, sessionId: sessionId, fetchList: fetchList, helpers: helpers, t: t, autoRefresh: drawerOpen }) }), _jsx(FileContextMenu, { open: newMenu.open, getAnchorRect: newMenu.getAnchorRect ?? (() => null), items: [
                    { id: 'new-file', label: t('newFile'), onSelect: () => setFileOp({ kind: 'new-file', parentDir: '' }) },
                    { id: 'new-folder', label: t('newFolder'), onSelect: () => setFileOp({ kind: 'new-folder', parentDir: '' }) },
                ], onClose: () => setNewMenu((prev) => ({ ...prev, open: false })) }), fileOp.kind !== 'idle' && fileOps !== undefined && (_jsx(FileOpsModal, { op: fileOp, fileOps: fileOps, fetchList: fetchList, sessionId: sessionId, t: t, onDone: handleOpDone, onCancel: handleOpCancel })), _jsx(FileExplorerPanel, { ref: previewPanelRef, title: panelTitle, onClose: handlePanelClose, t: t, children: previewChildren })] }));
});
