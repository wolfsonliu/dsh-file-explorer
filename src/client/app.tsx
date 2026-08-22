import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import { FILE_EXPLORER_ROUTE, STATIC_FILES_ROUTE, BROWSER_OPEN_EXTS, type BrowserEntry, type FilePreview, type PreviewMode } from '../protocol.ts'
import { FileExplorerDrawer, FloatingFileButton } from './drawer.tsx'
import { FileTree, type FileTreeHandle } from './file-tree.tsx'
import type { FileActionHelpers } from './file-action.tsx'
import { FileExplorerPanel, type FileExplorerPanelHandle } from './panel.tsx'
import { BinaryPreview, MarkdownPreview, TextPreview, makeTextPagedPreview, resolvePreviewFor } from './preview/index.ts'
import type { PreviewProps } from './preview/registry.ts'
import type { Translate } from './locale.ts'
import { FileOpsModal } from './file-ops-modal.tsx'
import { type FileOp, type FileOps } from './file-ops.ts'
import { FileContextMenu } from './context-menu.tsx'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileExplorerAppProps {
  sessionId: string | undefined
  fetchList: (sessionId: string, path: string) => Promise<BrowserEntry[]>
  /** Fetch one file's preview (injectable for tests). */
  fetchPreview: (sessionId: string, path: string, mode?: PreviewMode) => Promise<FilePreview | null>
  /** Translator for localized UI copy. */
  t: Translate
  /** Write a file back (injectable for tests); enables built-in markdown editing. */
  writeFile?: (path: string, content: string) => Promise<void>
  /** Read raw bytes (range-capable); enables built-in paged text preview. */
  readRawFile?: (path: string, offset?: number, limit?: number) => Promise<ArrayBuffer>
  /** File-operation backend (injectable for tests). */
  fileOps?: FileOps
}

export interface FileExplorerAppHandle {
  openDrawer(): void
  closeDrawer(): void
  toggleDrawer(): void
  openFile(path: string): void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the file extension (no leading dot); '' when absent. */
function extensionOf(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.')
  if (lastDot === -1 || lastDot === filePath.length - 1) return ''
  return filePath.slice(lastDot + 1)
}

/** Extract the basename (last path segment) of a workspace-relative path. */
function basenameOf(filePath: string): string {
  return filePath.split('/').at(-1) ?? filePath
}

/** Whether a path should be opened in a new browser tab (case-insensitive extension). */
function isBrowserOpenable(filePath: string): boolean {
  return (BROWSER_OPEN_EXTS as readonly string[]).includes(extensionOf(filePath).toLowerCase())
}

/**
 * Open a browser-renderable file in a new tab via the static files route.
 * Returns false when the tab was blocked (so the caller falls back to the
 * preview panel).
 */
function openInBrowserTab(sessionId: string | undefined, path: string): boolean {
  if (sessionId === undefined) return false
  const url =
    `${STATIC_FILES_ROUTE}/${encodeURIComponent(sessionId)}/` +
    path.split('/').map(encodeURIComponent).join('/')
  const win = window.open(url, '_blank')
  if (win === null) return false
  win.opener = null
  return true
}

// ---------------------------------------------------------------------------
// FileExplorerApp
// ---------------------------------------------------------------------------

/** Composes the floating button, left drawer, and floating preview box. */
export const FileExplorerApp = forwardRef<FileExplorerAppHandle, FileExplorerAppProps>(
  function FileExplorerApp({ sessionId, fetchList, fetchPreview, t, writeFile, readRawFile, fileOps }, ref) {
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [selectedPath, setSelectedPath] = useState<string | null>(null)
    const [previewData, setPreviewData] = useState<FilePreview | null>(null)
    const [viewMode, setViewMode] = useState<PreviewMode>('auto')
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState('')
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [dirty, setDirty] = useState(false)
    const [fileOp, setFileOp] = useState<FileOp>({ kind: 'idle' })
    const [newMenu, setNewMenu] = useState<{ open: boolean; getAnchorRect: (() => DOMRect | null) | null }>({ open: false, getAnchorRect: null })

    const previewPanelRef = useRef<FileExplorerPanelHandle>(null)
    const treeRef = useRef<FileTreeHandle>(null)
    const selectedPathRef = useRef<string | null>(null)
    const saveRef = useRef<{ path: string; promise: Promise<void> } | null>(null)

    const openDrawer = useCallback(() => setDrawerOpen(true), [])
    const closeDrawer = useCallback(() => setDrawerOpen(false), [])
    const toggleDrawer = useCallback(() => setDrawerOpen((prev) => !prev), [])

    const startEditing = useCallback(() => {
      if (previewData?.kind !== 'text') return
      setDraft(previewData.content)
      setEditing(true)
      setDirty(false)
      setSaveError(null)
    }, [previewData])

    const cancelEditing = useCallback(() => {
      setEditing(false)
      setSaving(false)
      setSaveError(null)
      setDirty(false)
    }, [])

    const saveDraft = useCallback((): Promise<void> => {
      if (writeFile === undefined || selectedPath === null) return Promise.resolve()
      const targetPath = selectedPath
      if (saveRef.current !== null && saveRef.current.path === targetPath) {
        return saveRef.current.promise
      }
      setSaving(true)
      setSaveError(null)
      const promise = (async (): Promise<void> => {
        try {
          await writeFile(targetPath, draft)
          if (selectedPathRef.current === targetPath) {
            setPreviewData((prev) => (prev && prev.kind === 'text' ? { ...prev, content: draft } : prev))
            setDirty(false)
          }
        } catch (error) {
          if (selectedPathRef.current === targetPath) {
            setDirty(true)
            setSaveError(error instanceof Error ? error.message : String(error))
          }
          throw error
        } finally {
          if (saveRef.current !== null && saveRef.current.path === targetPath) {
            saveRef.current = null
            setSaving(false)
          }
        }
      })()
      saveRef.current = { path: targetPath, promise }
      return promise
    }, [writeFile, selectedPath, draft])

    const handleSave = useCallback(() => {
      void saveDraft().catch(() => {})
    }, [saveDraft])

    const previewEditing = useCallback(async () => {
      const targetPath = selectedPath
      try {
        await saveDraft()
      } catch {
        return
      }
      if (selectedPathRef.current === targetPath) setEditing(false)
    }, [saveDraft, selectedPath])

    const handlePanelClose = useCallback(() => {
      if (editing && dirty && writeFile !== undefined) {
        void saveDraft().catch(() => {})
      }
      // The edit session ends when the panel closes, regardless of save outcome.
      setEditing(false)
      setDirty(false)
      setSaving(false)
      setDraft('')
      setSaveError(null)
    }, [editing, dirty, writeFile, saveDraft])

    const openFileWithMode = useCallback(
      async (path: string, mode: PreviewMode) => {
        // Browser-renderable files default-open in a new tab (before any
        // `await`, so the call stays inside the click gesture). When the tab
        // is blocked, fall through to the normal panel preview.
        if (mode === 'auto' && isBrowserOpenable(path) && openInBrowserTab(sessionId, path)) return
        if (editing && dirty && writeFile !== undefined) {
          try {
            await saveDraft()
          } catch {
            return // 保存失败：停留在当前文件，不切换
          }
        }
        setEditing(false)
        setDirty(false)
        setSaving(false)
        setSaveError(null)
        setDraft('')
        selectedPathRef.current = path
        setSelectedPath(path)
        setViewMode(mode)
        if (sessionId === undefined) return
        const request = mode === 'auto'
          ? fetchPreview(sessionId, path)
          : fetchPreview(sessionId, path, mode)
        void request
          .then((preview) => {
            setPreviewData(preview)
            setDrawerOpen(true)
            previewPanelRef.current?.open()
          })
          .catch(() => {
            // Ignore preview fetch failures.
          })
      },
      [sessionId, fetchPreview, editing, dirty, writeFile, saveDraft],
    )

    const openFile = useCallback((path: string) => { void openFileWithMode(path, 'auto') }, [openFileWithMode])
    const openFileAsText = useCallback((path: string) => { void openFileWithMode(path, 'text') }, [openFileWithMode])
    const openFileAsBinary = useCallback((path: string) => { void openFileWithMode(path, 'binary') }, [openFileWithMode])

    const copyAbsolutePath = useCallback(
      async (path: string) => {
        if (sessionId === undefined) return
        try {
          const res = await fetch(
            `${FILE_EXPLORER_ROUTE}?action=resolve-path&sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(path)}`,
          )
          const data = await res.json()
          await navigator.clipboard.writeText(data.path)
        } catch {
          // Ignore resolve-path / clipboard failures.
        }
      },
      [sessionId],
    )

    const copyRelativePath = useCallback(async (path: string) => {
      await navigator.clipboard.writeText(path)
    }, [])

    const handleOpDone = useCallback((newPath: string) => {
      const op = fileOp
      setFileOp({ kind: 'idle' })
      treeRef.current?.refresh()
      if (op.kind === 'rename' || op.kind === 'move') {
        if (selectedPathRef.current === op.entry.path) {
          selectedPathRef.current = newPath
          setSelectedPath(newPath)
          if (sessionId !== undefined) {
            void fetchPreview(sessionId, newPath)
              .then((preview) => { if (selectedPathRef.current === newPath) setPreviewData(preview) })
              .catch(() => { /* Ignore preview fetch failures. */ })
          }
        }
      } else if (op.kind === 'delete') {
        if (selectedPathRef.current === op.entry.path) {
          selectedPathRef.current = null
          setSelectedPath(null)
          setPreviewData(null)
          setEditing(false)
          setDirty(false)
          setDraft('')
          setSaveError(null)
          setSaving(false)
          previewPanelRef.current?.close()
        }
      }
    }, [fileOp, sessionId, fetchPreview])

    const handleOpCancel = useCallback(() => { setFileOp({ kind: 'idle' }) }, [])

    const openNewMenu = useCallback((getAnchorRect: () => DOMRect | null) => {
      setNewMenu({ open: true, getAnchorRect })
    }, [])

    const promptRename = useCallback((entry: BrowserEntry) => { setFileOp({ kind: 'rename', entry }) }, [])
    const promptDelete = useCallback((entry: BrowserEntry) => { setFileOp({ kind: 'delete', entry }) }, [])
    const promptMove = useCallback((entry: BrowserEntry) => { setFileOp({ kind: 'move', entry }) }, [])
    const promptCopy = useCallback((entry: BrowserEntry) => { setFileOp({ kind: 'copy', entry }) }, [])
    const promptNewFile = useCallback((parentDir: string) => { setFileOp({ kind: 'new-file', parentDir }) }, [])
    const promptNewFolder = useCallback((parentDir: string) => { setFileOp({ kind: 'new-folder', parentDir }) }, [])

    const helpers: FileActionHelpers = { openFile, openFileAsText, openFileAsBinary, copyAbsolutePath, copyRelativePath, promptRename, promptDelete, promptMove, promptCopy, promptNewFile, promptNewFolder }

    useImperativeHandle(
      ref,
      () => ({
        openDrawer,
        closeDrawer,
        toggleDrawer,
        openFile,
      }),
      [openDrawer, closeDrawer, toggleDrawer, openFile],
    )

    // Resolve the component that renders the current preview exactly once, so
    // the edit-affordance gate and the render branch agree on the same one.
    let resolvedComponent: ComponentType<PreviewProps> | null = null
    if (previewData !== null) {
      resolvedComponent =
        viewMode === 'text'
          ? makeTextPagedPreview(readRawFile)
          : viewMode === 'binary'
            ? BinaryPreview
            : resolvePreviewFor(previewData, extensionOf(selectedPath ?? ''), readRawFile)
    }

    // Built-in text editing: show the edit affordance only when the resolved
    // component is a built-in text renderer. A plugin that claims this
    // extension at higher priority resolves to a different component, so the
    // built-in editor is hidden and the extension takes over editing.
    const isMarkdown = resolvedComponent === MarkdownPreview
    const isEditableText =
      writeFile !== undefined &&
      viewMode === 'auto' &&
      previewData !== null &&
      previewData.kind === 'text' &&
      (resolvedComponent === TextPreview ||
        resolvedComponent === makeTextPagedPreview(readRawFile) ||
        isMarkdown)

    let previewChildren: ReactNode
    if (previewData === null) {
      previewChildren = <div className="dsh-fe-placeholder">{t('selectFile')}</div>
    } else {
      const PreviewComponent = resolvedComponent!
      if (isEditableText) {
        previewChildren = (
          <div className="dsh-fe-md">
            <div className="dsh-fe-md-toolbar">
              {editing ? (
                <>
                  <button className="dsh-fe-md-btn" data-fe-edit="cancel" onClick={cancelEditing} disabled={saving}>
                    {t('cancel')}
                  </button>
                  <button className="dsh-fe-md-btn" data-fe-edit="save" onClick={handleSave} disabled={saving}>
                    {saving ? t('saving') : t('save')}
                  </button>
                  {isMarkdown && (
                    <button className="dsh-fe-md-btn" data-fe-edit="preview" onClick={() => { void previewEditing() }} disabled={saving}>
                      {t('mdPreview')}
                    </button>
                  )}
                </>
              ) : (
                <button className="dsh-fe-md-btn" data-fe-edit="edit" onClick={startEditing}>
                  {t('edit')}
                </button>
              )}
            </div>
            {saveError !== null && (
              <div className="dsh-fe-md-error">{t('saveFailed')}: {saveError}</div>
            )}
            {editing ? (
              <textarea
                className="dsh-fe-md-editor"
                data-fe-edit="textarea"
                value={draft}
                disabled={saving}
                onChange={(e) => {
                  setDraft(e.target.value)
                  setDirty(true)
                }}
              />
            ) : (
              <PreviewComponent preview={previewData} filePath={selectedPath ?? ''} activeView="preview" t={t} />
            )}
          </div>
        )
      } else {
        previewChildren = (
          <PreviewComponent preview={previewData} filePath={selectedPath ?? ''} activeView="preview" t={t} />
        )
      }
    }

    const panelTitle = previewData?.name ?? (selectedPath ? basenameOf(selectedPath) : undefined)

    return (
      <>
        <FloatingFileButton onClick={toggleDrawer} t={t} open={drawerOpen} />
        <FileExplorerDrawer
          open={drawerOpen}
          onClose={closeDrawer}
          onRefresh={() => treeRef.current?.refresh()}
          onNew={openNewMenu}
          t={t}
        >
          <FileTree
            ref={treeRef}
            sessionId={sessionId}
            fetchList={fetchList}
            helpers={helpers}
            t={t}
            autoRefresh={drawerOpen}
            selectedPath={selectedPath}
          />
        </FileExplorerDrawer>
        <FileContextMenu
          open={newMenu.open}
          getAnchorRect={newMenu.getAnchorRect ?? (() => null)}
          items={[
            { id: 'new-file', label: t('newFile'), onSelect: () => setFileOp({ kind: 'new-file', parentDir: '' }) },
            { id: 'new-folder', label: t('newFolder'), onSelect: () => setFileOp({ kind: 'new-folder', parentDir: '' }) },
          ]}
          onClose={() => setNewMenu((prev) => ({ ...prev, open: false }))}
        />
        {fileOp.kind !== 'idle' && fileOps !== undefined && (
          <FileOpsModal
            op={fileOp}
            fileOps={fileOps}
            fetchList={fetchList}
            sessionId={sessionId}
            t={t}
            onDone={handleOpDone}
            onCancel={handleOpCancel}
          />
        )}
        <FileExplorerPanel ref={previewPanelRef} title={panelTitle} onClose={handlePanelClose} t={t}>
          {previewChildren}
        </FileExplorerPanel>
      </>
    )
  },
)
