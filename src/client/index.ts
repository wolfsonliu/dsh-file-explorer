import React, { type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { FILE_EXPLORER_ROUTE, type BrowserEntry, type FilePreview } from '../protocol.ts'
import { registerBuiltinPreviews } from './preview/index.ts'
import { resolvePreview } from './preview/registry.ts'
import type { PreviewProps } from './preview/registry.ts'
import { FileExplorerPanel, type FileExplorerPanelHandle } from './panel.tsx'
import { interceptFileLinks } from './intercept.ts'
import { mountSidebar } from './mount-sidebar.ts'
import { SidebarExplorer, type SidebarExplorerHandle } from './sidebar-explorer.tsx'
import { PANEL_CSS } from './styles.ts'

// ---------------------------------------------------------------------------
// Client context (the shape of the Cordis context the client plugin receives)
// ---------------------------------------------------------------------------

interface ClientContext {
  sessions: {
    list: {
      getSnapshot(): { current?: string; byId: Record<string, { id: string; cwd?: string }> }
      subscribe(fn: () => void): () => void
    }
  }
  workspaces: { openPath(path: string): Promise<void> }
  effect(callback: () => (() => void), label?: string): void
}

export const inject = ['sessions', 'workspaces']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extensionOf(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.')
  if (lastDot === -1 || lastDot === filePath.length - 1) return ''
  return filePath.slice(lastDot + 1)
}

// ---------------------------------------------------------------------------
// apply
// ---------------------------------------------------------------------------

interface PreviewState {
  path: string
  data: FilePreview
}

export function apply(ctx: ClientContext): void {
  registerBuiltinPreviews()

  // Inject panel styles (an external plugin cannot import a CSS module).
  const styleEl = document.createElement('style')
  styleEl.setAttribute('data-fe-style', '')
  styleEl.textContent = PANEL_CSS
  document.head.appendChild(styleEl)

  // Floating preview box (overlay panel). It starts closed; the placeholder
  // shows only once a file has been selected and the panel is opened.
  const previewHost = document.createElement('div')
  previewHost.setAttribute('data-fe-preview-host', '')
  document.body.appendChild(previewHost)
  const previewRoot = createRoot(previewHost)
  const previewPanelRef = React.createRef<FileExplorerPanelHandle>()
  let previewState: PreviewState | null = null

  function renderPreview(): void {
    let children: ReactNode
    if (previewState) {
      const PreviewComponent = resolvePreview(extensionOf(previewState.path))
      const previewProps: PreviewProps = {
        preview: previewState.data,
        filePath: previewState.path,
        activeView: 'preview',
      }
      children = React.createElement(PreviewComponent, previewProps)
    } else {
      children = React.createElement('div', { className: 'dsh-fe-placeholder' }, '从文件树选择文件')
    }
    previewRoot.render(React.createElement(FileExplorerPanel, { ref: previewPanelRef, children }))
  }

  renderPreview()

  // Sidebar tab + overlay file tree.
  const sidebarRef = React.createRef<SidebarExplorerHandle>()
  let sidebarRoot: ReturnType<typeof createRoot> | null = null
  let sidebarTab: 'sessions' | 'files' = 'sessions'

  const fetchList = async (sessionId: string, path: string): Promise<BrowserEntry[]> => {
    try {
      const res = await fetch(
        `${FILE_EXPLORER_ROUTE}?action=list&sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(path)}`,
      )
      const data = await res.json()
      return data.entries ?? []
    } catch {
      return []
    }
  }

  async function openFileInPanel(filePath: string): Promise<void> {
    const sessionId = ctx.sessions.list.getSnapshot().current
    try {
      if (sessionId) {
        const res = await fetch(
          `${FILE_EXPLORER_ROUTE}?action=preview&sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(filePath)}`,
        )
        const data = await res.json()
        if (data.ok && data.preview) {
          previewState = { path: filePath, data: data.preview }
          renderPreview()
          previewPanelRef.current?.open()
        }
      }
    } catch {
      // ignore preview fetch errors
    }
    sidebarRef.current?.showFiles()
    sidebarTab = 'files'
  }

  function renderSidebar(): void {
    if (!sidebarRoot) return
    const sessionId = ctx.sessions.list.getSnapshot().current
    sidebarRoot.render(
      React.createElement(SidebarExplorer, {
        ref: sidebarRef,
        sessionId,
        fetchList,
        onSelectFile: openFileInPanel,
      }),
    )
  }

  const disposeSidebar = mountSidebar((sidebarHost) => {
    sidebarRoot = createRoot(sidebarHost)
    renderSidebar()
  })

  // Re-render the sidebar when the session list changes (the current session
  // may be selected after this plugin loads, and switching sessions must
  // refresh the tree).
  const unsubscribeSessions = ctx.sessions.list.subscribe(() => {
    renderSidebar()
  })

  // Capture-phase click listener for intercepting file links.
  const handleClick = (event: MouseEvent) => {
    interceptFileLinks(event, openFileInPanel)
  }
  document.addEventListener('click', handleClick, true)

  // Keyboard shortcut Ctrl/Cmd+Shift+E toggles the sidebar tab (files ↔ sessions).
  const handleKeydown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'E') {
      event.preventDefault()
      if (sidebarTab === 'files') {
        sidebarTab = 'sessions'
        sidebarRef.current?.showSessions()
      } else {
        sidebarTab = 'files'
        sidebarRef.current?.showFiles()
      }
    }
  }
  document.addEventListener('keydown', handleKeydown)

  ctx.effect(() => {
    return () => {
      unsubscribeSessions()
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('keydown', handleKeydown)
      previewRoot.unmount()
      sidebarRoot?.unmount()
      previewHost.remove()
      styleEl.remove()
      disposeSidebar()
    }
  }, 'file-explorer: client')
}
