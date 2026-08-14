import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFile, readdir, realpath, stat } from 'node:fs/promises'
import { dirname, extname, relative, resolve, sep } from 'node:path'
import {
  FILE_EXPLORER_ROUTE,
  type ApiResponse,
  type BrowserEntry,
  type Config,
  type FilePreview,
} from './protocol.ts'

// ---------------------------------------------------------------------------
// Host context (the shape of the Cordis context the plugin receives)
// ---------------------------------------------------------------------------
interface HostContext {
  sessions: {
    get(id: string): { header: { cwd?: string } } | undefined
  }
  webServer: {
    register(route: {
      kind: 'exact'
      path: string
      handler(req: IncomingMessage, res: ServerResponse): Promise<void>
    }): () => void
  }
  effect(callback: () => (() => void), label?: string): void
}

// ---------------------------------------------------------------------------
// Dependencies injected by Cordis
// ---------------------------------------------------------------------------
export const inject = ['webServer', 'sessions']

// ---------------------------------------------------------------------------
// Image MIME map
// ---------------------------------------------------------------------------
const IMAGE_MIME: Record<string, string> = {
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

// ---------------------------------------------------------------------------
// inside — resolve a workspace-relative input to an absolute path, rejecting
// any path that escapes the workspace.
// ---------------------------------------------------------------------------
async function inside(root: string, input = ''): Promise<{ absolute: string; path: string }> {
  const absolute = await realpath(resolve(root, input || '.'))
  const path = relative(root, absolute)
  if (path === '..' || path.startsWith(`..${sep}`) || resolve(path) === path) {
    throw new Error('path is outside the configured workspace')
  }
  return { absolute, path: path.split(sep).join('/') }
}

// ---------------------------------------------------------------------------
// list — list one directory level; directories before files, each
// alphabetically by name; skip symlinks and hidden entries.
// ---------------------------------------------------------------------------
async function list(root: string, input: string): Promise<BrowserEntry[]> {
  const target = await inside(root, input)
  const children = await readdir(target.absolute, { withFileTypes: true })
  const entries = await Promise.all(
    children
      .filter(child => !child.isSymbolicLink())
      .map(async child => {
        const childPath = target.path === '' ? child.name : `${target.path}/${child.name}`
        if (child.isDirectory()) {
          return { name: child.name, path: childPath, kind: 'directory' as const }
        }
        const info = await stat(resolve(target.absolute, child.name))
        return { name: child.name, path: childPath, kind: 'file' as const, size: info.size }
      }),
  )
  return entries.sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1,
  )
}

// ---------------------------------------------------------------------------
// preview — read one file and return a discriminated preview.
// ---------------------------------------------------------------------------
async function preview(
  root: string,
  input: string,
  maxText: number,
  maxImage: number,
): Promise<FilePreview> {
  const target = await inside(root, input)
  const info = await stat(target.absolute)
  if (!info.isFile()) throw new Error('path is not a file')
  const name = target.path.split('/').at(-1) ?? target.path
  const extension = extname(name).toLowerCase()
  if (info.size === 0) return { kind: 'empty', name, size: 0 }
  const mime = IMAGE_MIME[extension]
  if (mime) {
    if (info.size > maxImage) return { kind: 'too-large', name, size: info.size }
    const body = await readFile(target.absolute)
    return { kind: 'image', name, mime, dataUrl: `data:${mime};base64,${body.toString('base64')}`, size: info.size }
  }
  if (info.size > maxText) return { kind: 'too-large', name, size: info.size }
  const body = await readFile(target.absolute)
  if (body.includes(0)) return { kind: 'binary', name, size: info.size }
  return { kind: 'text', name, extension, content: body.toString('utf8'), size: info.size }
}

// ---------------------------------------------------------------------------
// json — send a JSON response.
// ---------------------------------------------------------------------------
function json(res: ServerResponse, status: number, body: ApiResponse): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(JSON.stringify(body))
}

// ---------------------------------------------------------------------------
// apply — register the HTTP route.
// ---------------------------------------------------------------------------
export function apply(ctx: HostContext, config: Config = {}): void {
  const maxText = config.maxTextBytes ?? 2 * 1024 * 1024
  const maxImage = config.maxImageBytes ?? 10 * 1024 * 1024

  ctx.effect(() => {
    const disposeRoute = ctx.webServer.register({
      kind: 'exact',
      path: FILE_EXPLORER_ROUTE,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const url = new URL(req.url ?? FILE_EXPLORER_ROUTE, 'http://localhost')
          const sessionId = url.searchParams.get('sessionId')
          if (sessionId === null || sessionId === '') throw new Error('sessionId is required')
          const session = ctx.sessions.get(sessionId)
          const cwd = session?.header.cwd
          if (cwd === undefined) throw new Error('current session has no workspace')
          const root = resolve(cwd)
          const path = url.searchParams.get('path') ?? ''
          const action = url.searchParams.get('action') ?? 'list'
          if (action === 'list') return json(res, 200, { ok: true, root, entries: await list(root, path) })
          if (action === 'preview') return json(res, 200, { ok: true, preview: await preview(root, path, maxText, maxImage) })
          if (action === 'resolve-path') {
            const target = await inside(root, path)
            return json(res, 200, {
              ok: true,
              path: target.absolute,
              parentPath: dirname(target.absolute),
            })
          }
          return json(res, 400, { ok: false, error: 'unknown action' })
        } catch (error) {
          json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
        }
      },
    })
    return () => {
      disposeRoute()
    }
  }, 'file-explorer: workspace file API')
}

// ---------------------------------------------------------------------------
// Exported for testing
// ---------------------------------------------------------------------------
export { inside, list, preview }