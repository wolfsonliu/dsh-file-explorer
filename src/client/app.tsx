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
import { BinaryPreview, resolvePreviewFor, TextPreview } from './preview/index.ts'
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

// ---------------------------------------------------------------------------
// FileExplorerApp
// ---------------------------------------------------------------------------

/** Composes the floating button, left drawer, and floating preview box. */
export const FileExplorerApp = forwardRef<FileExplorerAppHandle, FileExplorerAppProps>(
  function FileExplorerApp({ sessionId, fetchList, fetchPreview, t }, ref) {
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [selectedPath, setSelectedPath] = useState<string | null>(null)
    const [previewData, setPreviewData] = useState<FilePreview | null>(null)
    const [viewMode, setViewMode] = useState<PreviewMode>('auto')

    const previewPanelRef = useRef<FileExplorerPanelHandle>(null)
    const treeRef = useRef<FileTreeHandle>(null)

    const openDrawer = useCallback(() => setDrawerOpen(true), [])
    const closeDrawer = useCallback(() => setDrawerOpen(false), [])
    const toggleDrawer = useCallback(() => setDrawerOpen((prev) => !prev), [])

    const openFileWithMode = useCallback(
      (path: string, mode: PreviewMode) => {
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
      [sessionId, fetchPreview],
    )

    const openFile = useCallback((path: string) => openFileWithMode(path, 'auto'), [openFileWithMode])
    const openFileAsText = useCallback((path: string) => openFileWithMode(path, 'text'), [openFileWithMode])
    const openFileAsBinary = useCallback((path: string) => openFileWithMode(path, 'binary'), [openFileWithMode])

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

    let previewChildren: ReactNode
    if (previewData === null) {
      previewChildren = <div className="dsh-fe-placeholder">{t('selectFile')}</div>
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
        <FileExplorerPanel ref={previewPanelRef} t={t}>
          {previewChildren}
        </FileExplorerPanel>
      </>
    )
  },
)
