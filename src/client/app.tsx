import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { BrowserEntry, FilePreview } from '../protocol.ts'
import { FileExplorerDrawer, FloatingFileButton } from './drawer.tsx'
import { FileTree, type FileTreeHandle } from './file-tree.tsx'
import { FileExplorerPanel, type FileExplorerPanelHandle } from './panel.tsx'
import { resolvePreview } from './preview/registry.ts'
import type { PreviewProps } from './preview/registry.ts'
import type { Translate } from './locale.ts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileExplorerAppProps {
  sessionId: string | undefined
  fetchList: (sessionId: string, path: string) => Promise<BrowserEntry[]>
  /** Fetch one file's preview (injectable for tests). */
  fetchPreview: (sessionId: string, path: string) => Promise<FilePreview | null>
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

    const previewPanelRef = useRef<FileExplorerPanelHandle>(null)
    const treeRef = useRef<FileTreeHandle>(null)

    const openDrawer = useCallback(() => setDrawerOpen(true), [])
    const closeDrawer = useCallback(() => setDrawerOpen(false), [])
    const toggleDrawer = useCallback(() => setDrawerOpen((prev) => !prev), [])

    const openFile = useCallback(
      (path: string) => {
        setSelectedPath(path)
        if (sessionId === undefined) return
        void fetchPreview(sessionId, path)
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
      const PreviewComponent = resolvePreview(extensionOf(selectedPath ?? ''))
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
            onSelectFile={(path) => openFile(path)}
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
