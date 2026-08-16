import React from 'react'
import { createRoot } from 'react-dom/client'
import { FILE_EXPLORER_ROUTE } from '../protocol.ts'
import { registerBuiltinPreviews } from './preview/index.ts'
import { registerPreview } from './preview/registry.ts'
import { registerBuiltinFileActions, registerFileAction } from './file-action.ts'
import { FileExplorerApp, type FileExplorerAppHandle } from './app.tsx'
import { interceptFileLinks } from './intercept.ts'
import { PANEL_CSS } from './styles.ts'
import {
  FILE_EXPLORER_NS,
  registerFileExplorerLocale,
  type Translate,
} from './locale.ts'

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
  locale: {
    register(ns: string, locale: string, dict: Record<string, string>): () => void
    bind(ns: string): Translate
    subscribe(fn: () => void): () => void
  }
  reflect: { provide(name: string, value: unknown): void }
  effect(callback: () => (() => void), label?: string): void
}

export const inject = ['sessions', 'workspaces', 'locale']

// ---------------------------------------------------------------------------
// apply
// ---------------------------------------------------------------------------

export function apply(ctx: ClientContext): void {
  registerBuiltinPreviews()
  registerBuiltinFileActions()

  // Write UTF-8 text to a workspace file (for preview plugins that edit).
  const writeFile = async (path: string, content: string): Promise<void> => {
    const sessionId = ctx.sessions.list.getSnapshot().current
    if (sessionId === undefined) throw new Error('no current session')
    const res = await fetch(
      `${FILE_EXPLORER_ROUTE}?action=write&sessionId=${encodeURIComponent(sessionId)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path, content }),
      },
    )
    const data = await res.json()
    if (!data.ok) throw new Error(data.error)
  }

  // Expose the registration services so external plugins can contribute
  // previewers, file-row actions, and file writes (override built-ins by priority).
  ctx.reflect.provide('fileExplorer', { registerPreview, registerFileAction, writeFile })

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

  // Register localized copy and bind a stable translator.
  const disposeLocale = registerFileExplorerLocale(ctx)
  const t = ctx.locale.bind(FILE_EXPLORER_NS)

  function render(): void {
    const sessionId = ctx.sessions.list.getSnapshot().current
    root.render(
      React.createElement(FileExplorerApp, {
        ref: appRef,
        sessionId,
        t,
        writeFile,
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
        fetchPreview: async (sid, path, mode) => {
          try {
            const modeParam = mode && mode !== 'auto' ? `&mode=${encodeURIComponent(mode)}` : ''
            const res = await fetch(
              `${FILE_EXPLORER_ROUTE}?action=preview&sessionId=${encodeURIComponent(sid)}&path=${encodeURIComponent(path)}${modeParam}`,
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
  const unsubscribeLocale = ctx.locale.subscribe(() => {
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
      disposeLocale()
      unsubscribeSessions()
      unsubscribeLocale()
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('keydown', handleKeydown)
      root.unmount()
      host.remove()
      styleEl.remove()
    }
  }, 'file-explorer: client')
}
