import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { FILE_EXPLORER_ROUTE, type BrowserEntry, type FilePreview, type PreviewMode } from '../protocol.ts'
import { FileExplorerDrawer, FloatingFileButton } from './drawer.tsx'
import { FileTree, type FileTreeHandle } from './file-tree.tsx'
import type { FileActionHelpers } from './file-action.ts'
import { FileExplorerPanel, type FileExplorerPanelHandle } from './panel.tsx'
import { BinaryPreview, MarkdownPreview, resolvePreviewFor, TextPreview } from './preview/index.ts'
import type { PreviewProps } from './preview/registry.ts'
import type { Translate } from './locale.ts'

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

// ---------------------------------------------------------------------------
// FileExplorerApp
// ---------------------------------------------------------------------------

/** Composes the floating button, left drawer, and floating preview box. */
export const FileExplorerApp = forwardRef<FileExplorerAppHandle, FileExplorerAppProps>(
  function FileExplorerApp({ sessionId, fetchList, fetchPreview, t, writeFile }, ref) {
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [selectedPath, setSelectedPath] = useState<string | null>(null)
    const [previewData, setPreviewData] = useState<FilePreview | null>(null)
    const [viewMode, setViewMode] = useState<PreviewMode>('auto')
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState('')
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [dirty, setDirty] = useState(false)

    const previewPanelRef = useRef<FileExplorerPanelHandle>(null)
    const treeRef = useRef<FileTreeHandle>(null)
    const selectedPathRef = useRef<string | null>(null)

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

    const saveDraft = useCallback(async (): Promise<void> => {
      if (writeFile === undefined || selectedPath === null) return
      const targetPath = selectedPath
      setSaving(true)
      setSaveError(null)
      try {
        await writeFile(targetPath, draft)
        if (selectedPathRef.current === targetPath) {
          setPreviewData((prev) => (prev && prev.kind === 'text' ? { ...prev, content: draft } : prev))
          setDirty(false)
        }
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : String(error))
        throw error
      } finally {
        setSaving(false)
      }
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

    const openFileWithMode = useCallback(
      async (path: string, mode: PreviewMode) => {
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

    const helpers: FileActionHelpers = { openFile, openFileAsText, openFileAsBinary, copyAbsolutePath, copyRelativePath }

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

    // Built-in markdown editing only: a plugin overriding 'md' resolves to a
    // different component, so the edit affordance is hidden in that case.
    const isEditableMarkdown =
      writeFile !== undefined &&
      viewMode === 'auto' &&
      previewData !== null &&
      previewData.kind === 'text' &&
      resolvePreviewFor(previewData, extensionOf(selectedPath ?? '')) === MarkdownPreview

    let previewChildren: ReactNode
    if (previewData === null) {
      previewChildren = <div className="dsh-fe-placeholder">{t('selectFile')}</div>
    } else if (isEditableMarkdown) {
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
                <button className="dsh-fe-md-btn" data-fe-edit="preview" onClick={() => { void previewEditing() }} disabled={saving}>
                  {t('mdPreview')}
                </button>
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
              onChange={(e) => {
                setDraft(e.target.value)
                setDirty(true)
              }}
            />
          ) : (
            <MarkdownPreview preview={previewData} filePath={selectedPath ?? ''} activeView="preview" t={t} />
          )}
        </div>
      )
    } else {
      const PreviewComponent =
        viewMode === 'text'
          ? TextPreview
          : viewMode === 'binary'
            ? BinaryPreview
            : resolvePreviewFor(previewData, extensionOf(selectedPath ?? ''))
      const previewProps: PreviewProps = {
        preview: previewData,
        filePath: selectedPath ?? '',
        activeView: 'preview',
        t,
      }
      previewChildren = <PreviewComponent {...previewProps} />
    }

    const panelTitle = previewData?.name ?? (selectedPath ? basenameOf(selectedPath) : undefined)

    return (
      <>
        <FloatingFileButton onClick={toggleDrawer} t={t} />
        <FileExplorerDrawer
          open={drawerOpen}
          onClose={closeDrawer}
          onRefresh={() => treeRef.current?.refresh()}
          t={t}
        >
          <FileTree
            ref={treeRef}
            sessionId={sessionId}
            fetchList={fetchList}
            helpers={helpers}
            t={t}
          />
        </FileExplorerDrawer>
        <FileExplorerPanel ref={previewPanelRef} title={panelTitle} t={t}>
          {previewChildren}
        </FileExplorerPanel>
      </>
    )
  },
)
