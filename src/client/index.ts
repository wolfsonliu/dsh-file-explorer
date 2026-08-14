import React from 'react'
import { createRoot } from 'react-dom/client'
import { FILE_EXPLORER_ROUTE } from '../protocol.ts'
import { registerBuiltinPreviews } from './preview/index.ts'
import { FileExplorerApp, type FileExplorerAppHandle } from './app.tsx'
import { interceptFileLinks } from './intercept.ts'
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
// apply
// ---------------------------------------------------------------------------

export function apply(ctx: ClientContext): void {
  registerBuiltinPreviews()

  // Inject panel styles (an external plugin cannot import a CSS module).
  const styleEl = document.createElement('style')
  styleEl.setAttribute('data-fe-style', '')
  styleEl.textContent = PANEL_CSS
  document.head.appendChild(styleEl)

  // Single React root rendering the floating button, drawer, and preview box.
  const host = document.createElement('div')
  host.setAttribute('data-fe-host', '')
  document.body.appendChild(host)
  const root = createRoot(host)
  const appRef = React.createRef<FileExplorerAppHandle>()

  function render(): void {
    const sessionId = ctx.sessions.list.getSnapshot().current
    root.render(
      React.createElement(FileExplorerApp, {
        ref: appRef,
        sessionId,
        fetchList: async (sid, path) => {
          try {
            const res = await fetch(
              `${FILE_EXPLORER_ROUTE}?action=list&sessionId=${encodeURIComponent(sid)}&path=${encodeURIComponent(path)}`,
            )
            const data = await res.json()
            return data.entries ?? []
          } catch {
            return []
          }
        },
        fetchPreview: async (sid, path) => {
          try {
            const res = await fetch(
              `${FILE_EXPLORER_ROUTE}?action=preview&sessionId=${encodeURIComponent(sid)}&path=${encodeURIComponent(path)}`,
            )
            const data = await res.json()
            return data.preview ?? null
          } catch {
            return null
          }
        },
      }),
    )
  }

  render()
  const unsubscribeSessions = ctx.sessions.list.subscribe(() => {
    render()
  })

  // Capture-phase click listener for intercepting file links.
  const handleClick = (event: MouseEvent) => {
    interceptFileLinks(event, (path) => {
      appRef.current?.openFile(path)
    })
  }
  document.addEventListener('click', handleClick, true)

  // Keyboard shortcut Ctrl/Cmd+Shift+E toggles the drawer.
  const handleKeydown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'E') {
      event.preventDefault()
      appRef.current?.toggleDrawer()
    }
  }
  document.addEventListener('keydown', handleKeydown)

  ctx.effect(() => {
    return () => {
      unsubscribeSessions()
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('keydown', handleKeydown)
      root.unmount()
      host.remove()
      styleEl.remove()
    }
  }, 'file-explorer: client')
}
