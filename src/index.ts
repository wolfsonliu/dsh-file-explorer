import type { IncomingMessage, ServerResponse } from 'node:http'
import { createReadStream, type Stats } from 'node:fs'
import {
  cp as fsCp,
  mkdir as fsMkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename as fsRename,
  rm as fsRm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import {
  FILE_EXPLORER_ROUTE,
  PDF_ACTION,
  STATIC_FILES_ROUTE,
  type ApiResponse,
  type BrowserEntry,
  type Config,
  type FilePreview,
  type PreviewMode,
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
      kind: 'exact' | 'prefix'
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

/** Extensions streamed inline for the browser's native viewer (whitelist). */
const INLINE_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
}

/** Content types for the `/file-explorer/files` static prefix route. */
const STATIC_MIME: Record<string, string> = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.xhtml': 'application/xhtml+xml',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.md': 'text/plain',
  '.csv': 'text/csv',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
}

/** Document types served with an `inline` Content-Disposition. */
const STATIC_INLINE_EXTS = new Set(['.html', '.htm', '.xhtml', '.svg', '.pdf'])

/** Types eligible for the optional `inlineCsp` Content-Security-Policy header. */
const STATIC_CSP_EXTS = new Set(['.html', '.htm', '.xhtml', '.svg'])

// ---------------------------------------------------------------------------
// inside — resolve a workspace-relative input to an absolute path, rejecting
// any path that escapes the workspace.
// ---------------------------------------------------------------------------
async function inside(root: string, input = '', opts?: { allowMissing?: boolean }): Promise<{ absolute: string; path: string }> {
  const resolved = resolve(root, input || '.')
  // realpath resolves symlinks but requires the path to exist. A write may
  // target a new file, so with allowMissing we resolve only the parent (which
  // must exist) and keep the final component literal.
  const absolute = opts?.allowMissing
    ? join(await realpath(dirname(resolved)), basename(resolved))
    : await realpath(resolved)
  const path = relative(root, absolute)
  if (path === '..' || path.startsWith(`..${sep}`) || resolve(path) === path) {
    throw new Error('path is outside the configured workspace')
  }
  return { absolute, path: path.split(sep).join('/') }
}

// ---------------------------------------------------------------------------
// list cache — an in-memory cache of directory listings keyed by
// `root + '\0' + path`, invalidated by directory mtime and a short TTL.
// ---------------------------------------------------------------------------
interface ListCacheEntry {
  mtimeMs: number
  expiresAt: number
  entries: BrowserEntry[]
}

const listCache = new Map<string, ListCacheEntry>()
const LIST_CACHE_TTL_MS = 2000

/** Drop all cached directory listings (called after a write changes entry sizes). */
function invalidateListCache(): void {
  listCache.clear()
}

// ---------------------------------------------------------------------------
// list — list one directory level; directories before files, each
// alphabetically by name; skip symlinks and (unless showHidden) dotfiles.
// ---------------------------------------------------------------------------
async function list(root: string, input: string, showHidden = false): Promise<BrowserEntry[]> {
  const target = await inside(root, input)
  const dirInfo = await stat(target.absolute)
  const cacheKey = `${root}\0${target.path}\0${showHidden}`
  const cached = listCache.get(cacheKey)
  const now = Date.now()
  if (cached !== undefined && cached.mtimeMs === dirInfo.mtimeMs && now < cached.expiresAt) {
    return cached.entries
  }
  const children = await readdir(target.absolute, { withFileTypes: true })
  const entries = await Promise.all(
    children
      .filter(child => !child.isSymbolicLink() && (showHidden || !child.name.startsWith('.')))
      .map(async child => {
        const childPath = target.path === '' ? child.name : `${target.path}/${child.name}`
        if (child.isDirectory()) {
          return { name: child.name, path: childPath, kind: 'directory' as const }
        }
        const info = await stat(resolve(target.absolute, child.name))
        return { name: child.name, path: childPath, kind: 'file' as const, size: info.size }
      }),
  )
  const sorted = entries.sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1,
  )
  listCache.set(cacheKey, { mtimeMs: dirInfo.mtimeMs, expiresAt: now + LIST_CACHE_TTL_MS, entries: sorted })
  return sorted
}

/** Read the first `maxBytes` bytes of a file (bounded; never reads more). */
async function readHead(absolute: string, maxBytes: number): Promise<Buffer> {
  const handle = await open(absolute, 'r')
  try {
    const buffer = Buffer.alloc(maxBytes)
    // A single read may return fewer bytes than requested (short read), so loop
    // until the buffer is full or EOF (bytesRead === 0).
    let offset = 0
    while (offset < maxBytes) {
      const { bytesRead } = await handle.read(buffer, offset, maxBytes - offset, offset)
      if (bytesRead === 0) break
      offset += bytesRead
    }
    return buffer.subarray(0, offset)
  } finally {
    await handle.close()
  }
}

/** Build a binary preview (hexdump payload) from a byte buffer, capped to `maxBinary`. */
function binaryFrom(name: string, size: number, bytes: Buffer, maxBinary: number): FilePreview {
  const head = bytes.subarray(0, Math.min(maxBinary, bytes.length))
  return {
    kind: 'binary',
    name,
    size,
    bytes: head.toString('base64'),
    truncated: size > maxBinary,
  }
}

// ---------------------------------------------------------------------------
// preview — read one file and return a discriminated preview.
// ---------------------------------------------------------------------------
async function preview(
  root: string,
  input: string,
  maxText: number,
  maxImage: number,
  mode: PreviewMode = 'auto',
  maxBinary = 64 * 1024,
): Promise<FilePreview> {
  const target = await inside(root, input)
  const info = await stat(target.absolute)
  if (!info.isFile()) throw new Error('path is not a file')
  const name = target.path.split('/').at(-1) ?? target.path
  const extension = extname(name).toLowerCase()
  if (info.size === 0) return { kind: 'empty', name, size: 0 }
  if (mode === 'binary') {
    const head = await readHead(target.absolute, maxBinary)
    return binaryFrom(name, info.size, head, maxBinary)
  }
  if (mode === 'text') {
    if (info.size > maxText) return { kind: 'text-large', name, extension, size: info.size }
    const body = await readFile(target.absolute)
    return { kind: 'text', name, extension, content: body.toString('utf8'), size: info.size }
  }
  const mime = IMAGE_MIME[extension]
  if (mime) {
    if (info.size > maxImage) return { kind: 'too-large', name, size: info.size }
    const body = await readFile(target.absolute)
    return { kind: 'image', name, mime, dataUrl: `data:${mime};base64,${body.toString('base64')}`, size: info.size }
  }
  if (info.size > maxText) {
    const head = await readHead(target.absolute, maxBinary)
    if (head.includes(0)) return binaryFrom(name, info.size, head, maxBinary)
    return { kind: 'text-large', name, extension, size: info.size }
  }
  const body = await readFile(target.absolute)
  if (body.includes(0)) return binaryFrom(name, info.size, body, maxBinary)
  return { kind: 'text', name, extension, content: body.toString('utf8'), size: info.size }
}

// ---------------------------------------------------------------------------
// raw — read a file as raw bytes, with optional Range support.
// ---------------------------------------------------------------------------
async function raw(
  root: string,
  input: string,
  maxRaw: number,
  range?: { offset: number; limit?: number },
): Promise<{ buffer: Buffer; size: number }> {
  const target = await inside(root, input)
  const info = await stat(target.absolute)
  if (!info.isFile()) throw new Error('path is not a file')
  const offset = range?.offset ?? 0
  const limit = range?.limit !== undefined
    ? Math.min(range.limit, maxRaw)
    : Math.min(info.size - offset, maxRaw)
  if (limit <= 0 || offset >= info.size) throw new Error('invalid range')
  const handle = await open(target.absolute, 'r')
  try {
    const buffer = Buffer.alloc(limit)
    let pos = 0
    while (pos < limit) {
      const { bytesRead } = await handle.read(buffer, pos, limit - pos, offset + pos)
      if (bytesRead === 0) break
      pos += bytesRead
    }
    return { buffer: buffer.subarray(0, pos), size: info.size }
  } finally {
    await handle.close()
  }
}

// ---------------------------------------------------------------------------
// write — write UTF-8 text to a workspace file, rejecting escapes.
// ---------------------------------------------------------------------------
async function write(root: string, input: string, content: string): Promise<string> {
  const target = await inside(root, input, { allowMissing: true })
  await writeFile(target.absolute, content, 'utf8')
  return target.path
}

// ---------------------------------------------------------------------------
// Mutation guards shared by the file-operation actions.
// ---------------------------------------------------------------------------

/** Reject operating on the workspace root itself ('' or '.'). */
function assertNotRoot(input: string): void {
  if (input === '' || input === '.') throw new Error('cannot operate on the workspace root')
}

/** Reject an empty, dot, parent, or path-separator-containing final segment. */
function assertValidName(name: string): void {
  if (name === '' || name === '.' || name === '..' || name.includes('/') || name.includes('\\')) {
    throw new Error('invalid name')
  }
}

/** Whether a path exists (any file type). */
async function exists(absolute: string): Promise<boolean> {
  try {
    await stat(absolute)
    return true
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw err
  }
}

/** Join a workspace-relative parent ('' = root) with a final segment. */
function joinRel(parent: string, name: string): string {
  return parent === '' ? name : `${parent}/${name}`
}

/** Reject moving/copying a directory into itself or one of its descendants. */
function assertNotDescendant(kind: 'move' | 'copy', destPath: string, sourcePath: string): void {
  if (sourcePath === '') return
  if (destPath === sourcePath || destPath.startsWith(`${sourcePath}/`)) {
    throw new Error(`cannot ${kind} a directory into itself`)
  }
}

async function createFile(root: string, input: string): Promise<string> {
  assertNotRoot(input)
  assertValidName(input.split('/').at(-1) ?? '')
  const target = await inside(root, input, { allowMissing: true })
  if (await exists(target.absolute)) throw new Error('path already exists')
  await writeFile(target.absolute, '', 'utf8')
  return target.path
}

async function mkdir(root: string, input: string): Promise<string> {
  assertNotRoot(input)
  assertValidName(input.split('/').at(-1) ?? '')
  const target = await inside(root, input, { allowMissing: true })
  if (await exists(target.absolute)) throw new Error('path already exists')
  await fsMkdir(target.absolute)
  return target.path
}

/** Parse an HTTP Range header ("bytes=start-end" or "bytes=start-") into inclusive byte offsets. */
function parseRange(header: string | undefined): { start: number; end?: number } | undefined {
  if (header === undefined) return undefined
  const match = /^bytes=(\d+)-(\d*)$/.exec(header)
  if (match === null) return undefined
  const start = Number(match[1])
  const endPart = match[2]
  return endPart === '' ? { start } : { start, end: Number(endPart) }
}

// ---------------------------------------------------------------------------
// servePdf — stream one inline-capable file (whitelisted MIME) to the response.
// All validation runs before writeHead so a rejection can still send JSON.
// ---------------------------------------------------------------------------
async function servePdf(
  root: string,
  input: string,
  rangeHeader: string | undefined,
  res: ServerResponse,
): Promise<void> {
  const target = await inside(root, input)
  const info = await stat(target.absolute)
  if (!info.isFile()) throw new Error('path is not a file')
  const mime = INLINE_MIME[extname(target.path).toLowerCase()]
  if (mime === undefined) throw new Error('unsupported file type')
  const name = target.path.split('/').at(-1) ?? target.path
  const range = parseRange(rangeHeader)

  if (range !== undefined) {
    if (range.start >= info.size) {
      res.writeHead(416, { 'content-range': `bytes */${info.size}` })
      res.end()
      return
    }
    const end = range.end !== undefined ? Math.min(range.end, info.size - 1) : info.size - 1
    if (end < range.start) {
      res.writeHead(416, { 'content-range': `bytes */${info.size}` })
      res.end()
      return
    }
    res.writeHead(206, {
      'content-type': mime,
      'content-disposition': `inline; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'content-range': `bytes ${range.start}-${end}/${info.size}`,
      'content-length': String(end - range.start + 1),
      'accept-ranges': 'bytes',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    })
    const stream = createReadStream(target.absolute, { start: range.start, end })
    stream.on('error', () => res.destroy())
    stream.pipe(res)
    return
  }

  res.writeHead(200, {
    'content-type': mime,
    'content-disposition': `inline; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    'accept-ranges': 'bytes',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  const stream = createReadStream(target.absolute)
  stream.on('error', () => res.destroy())
  stream.pipe(res)
}

// ---------------------------------------------------------------------------
// static route — serve workspace files for browser-native rendering.
// ---------------------------------------------------------------------------

/** Build the common response headers for the static route. */
function staticHeaders(
  mime: string,
  ext: string,
  name: string,
  csp: string | undefined,
  extra: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': mime,
    'accept-ranges': 'bytes',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extra,
  }
  if (STATIC_INLINE_EXTS.has(ext)) {
    headers['content-disposition'] = `inline; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`
  }
  if (csp !== undefined && csp !== '' && STATIC_CSP_EXTS.has(ext)) {
    headers['content-security-policy'] = csp
  }
  return headers
}

/** Stream one file (with Range support) using static-route headers. */
async function streamStatic(
  absolute: string,
  filePath: string,
  info: Stats,
  rangeHeader: string | undefined,
  csp: string | undefined,
  res: ServerResponse,
): Promise<void> {
  const ext = extname(filePath).toLowerCase()
  const mime = STATIC_MIME[ext] ?? 'application/octet-stream'
  const name = filePath.split('/').at(-1) ?? filePath
  const range = parseRange(rangeHeader)

  if (range !== undefined) {
    if (range.start >= info.size) {
      res.writeHead(416, { 'content-range': `bytes */${info.size}` })
      res.end()
      return
    }
    const end = range.end !== undefined ? Math.min(range.end, info.size - 1) : info.size - 1
    if (end < range.start) {
      res.writeHead(416, { 'content-range': `bytes */${info.size}` })
      res.end()
      return
    }
    res.writeHead(206, staticHeaders(mime, ext, name, csp, {
      'content-range': `bytes ${range.start}-${end}/${info.size}`,
      'content-length': String(end - range.start + 1),
    }))
    const stream = createReadStream(absolute, { start: range.start, end })
    stream.on('error', () => res.destroy())
    stream.pipe(res)
    return
  }

  res.writeHead(200, staticHeaders(mime, ext, name, csp, {}))
  const stream = createReadStream(absolute)
  stream.on('error', () => res.destroy())
  stream.pipe(res)
}

/**
 * Serve one workspace file under the static prefix route. Directories fall
 * back to their `index.html`. Throws the `inside` containment error for
 * escapes, ENOENT for missing files — the route handler maps those to 400/404.
 */
async function serveStatic(
  root: string,
  input: string,
  rangeHeader: string | undefined,
  csp: string | undefined,
  res: ServerResponse,
): Promise<void> {
  let resolved = await inside(root, input)
  let info = await stat(resolved.absolute)
  if (info.isDirectory()) {
    resolved = await inside(root, resolved.path === '' ? 'index.html' : `${resolved.path}/index.html`)
    info = await stat(resolved.absolute)
  }
  if (!info.isFile()) throw new Error('path is not a file')
  await streamStatic(resolved.absolute, resolved.path, info, rangeHeader, csp, res)
}

type ParsedStaticPath = { sessionId: string; relPath: string } | { error: string }

/** Parse `/file-explorer/files/<sessionId>/<relative/path…>` from a pathname. */
function parseStaticPath(pathname: string): ParsedStaticPath {
  if (pathname === STATIC_FILES_ROUTE || pathname === `${STATIC_FILES_ROUTE}/`) {
    return { error: 'sessionId is required' }
  }
  const segments = pathname.slice(STATIC_FILES_ROUTE.length).split('/').filter((segment) => segment !== '')
  if (segments.length === 0) return { error: 'sessionId is required' }
  let sessionId: string
  let decoded: string[]
  try {
    sessionId = decodeURIComponent(segments[0])
    decoded = segments.slice(1).map((segment) => decodeURIComponent(segment))
  } catch {
    return { error: 'invalid path encoding' }
  }
  for (const segment of decoded) {
    if (segment === '..' || segment.includes('/') || segment.includes('\\')) {
      return { error: 'invalid path' }
    }
  }
  return { sessionId, relPath: decoded.join('/') }
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
// requestBody — read a JSON request body (bounded).
// ---------------------------------------------------------------------------
async function requestBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += value.length
    if (size > 3 * 1024 * 1024) throw new Error('request body is too large')
    chunks.push(value)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
}

// ---------------------------------------------------------------------------
// capBytes — normalize a byte cap to a positive integer, falling back to a
// default when the configured value is missing or invalid.
// ---------------------------------------------------------------------------
function capBytes(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

// ---------------------------------------------------------------------------
// apply — register the HTTP route.
// ---------------------------------------------------------------------------
export function apply(ctx: HostContext, config: Config = {}): void {
  const maxText = capBytes(config.maxTextBytes, 2 * 1024 * 1024)
  const maxImage = capBytes(config.maxImageBytes, 10 * 1024 * 1024)
  const maxBinary = capBytes(config.maxBinaryBytes, 64 * 1024)
  const maxRaw = capBytes(config.maxRawBytes, 100 * 1024 * 1024)
  const showHidden = config.showHidden === true
  const inlineCsp = typeof config.inlineCsp === 'string' && config.inlineCsp.trim() !== '' ? config.inlineCsp : undefined

  ctx.effect(() => {
    const disposeApiRoute = ctx.webServer.register({
      kind: 'exact',
      path: FILE_EXPLORER_ROUTE,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const url = new URL(req.url ?? FILE_EXPLORER_ROUTE, 'http://localhost')
          const body = req.method === 'POST' ? await requestBody(req) : {}
          const sessionId = typeof body.sessionId === 'string' ? body.sessionId : url.searchParams.get('sessionId')
          if (sessionId === null || sessionId === '') throw new Error('sessionId is required')
          const session = ctx.sessions.get(sessionId)
          const cwd = session?.header.cwd
          if (cwd === undefined) throw new Error('current session has no workspace')
          const root = resolve(cwd)
          const path = typeof body.path === 'string' ? body.path : url.searchParams.get('path') ?? ''
          const action = typeof body.action === 'string' ? body.action : url.searchParams.get('action') ?? 'list'
          if (action === 'list') return json(res, 200, { ok: true, root, entries: await list(root, path, showHidden) })
          if (action === 'preview') {
            const mode = typeof body.mode === 'string' ? body.mode : url.searchParams.get('mode') ?? 'auto'
            if (mode !== 'auto' && mode !== 'text' && mode !== 'binary') {
              return json(res, 400, { ok: false, error: 'unknown mode' })
            }
            return json(res, 200, { ok: true, preview: await preview(root, path, maxText, maxImage, mode as PreviewMode, maxBinary) })
          }
          if (action === 'resolve-path') {
            const target = await inside(root, path)
            return json(res, 200, {
              ok: true,
              path: target.absolute,
              parentPath: dirname(target.absolute),
            })
          }
          if (action === PDF_ACTION) {
            return await servePdf(root, path, req.headers.range, res)
          }
          if (action === 'raw') {
            const parsed = parseRange(req.headers.range)
            let range: { offset: number; limit?: number } | undefined
            if (parsed) {
              range = parsed.end !== undefined
                ? { offset: parsed.start, limit: parsed.end - parsed.start + 1 }
                : { offset: parsed.start }
            }
            try {
              const { buffer, size } = await raw(root, path, maxRaw, range)
              if (range) {
                const end = range.offset + buffer.length - 1
                res.writeHead(206, {
                  'content-type': 'application/octet-stream',
                  'content-length': String(buffer.length),
                  'content-range': `bytes ${range.offset}-${end}/${size}`,
                  'accept-ranges': 'bytes',
                  'cache-control': 'no-store',
                  'x-content-type-options': 'nosniff',
                })
              } else {
                res.writeHead(200, {
                  'content-type': 'application/octet-stream',
                  'content-length': String(buffer.length),
                  'accept-ranges': 'bytes',
                  'cache-control': 'no-store',
                  'x-content-type-options': 'nosniff',
                })
              }
              res.end(buffer)
              return
            } catch (err) {
              // Ignore: raw() throws 'invalid range' for out-of-bounds; return 416.
              if (err instanceof Error && err.message === 'invalid range') {
                res.writeHead(416, { 'content-range': `bytes */${(await stat(resolve(root, path))).size}` })
                res.end()
                return
              }
              throw err
            }
          }
          if (action === 'write') {
            if (typeof body.content !== 'string') throw new Error('content is required')
            const saved = await write(root, path, body.content)
            invalidateListCache()
            return json(res, 200, { ok: true, saved })
          }
          return json(res, 400, { ok: false, error: 'unknown action' })
        } catch (error) {
          json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
        }
      },
    })
    const disposeStaticRoute = ctx.webServer.register({
      kind: 'prefix',
      path: STATIC_FILES_ROUTE,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const url = new URL(req.url ?? STATIC_FILES_ROUTE, 'http://localhost')
          const parsed = parseStaticPath(url.pathname)
          if ('error' in parsed) return json(res, 400, { ok: false, error: parsed.error })
          const session = ctx.sessions.get(parsed.sessionId)
          const cwd = session?.header.cwd
          if (cwd === undefined) throw new Error('current session has no workspace')
          return await serveStatic(resolve(cwd), parsed.relPath, req.headers.range, inlineCsp, res)
        } catch (error) {
          const code = error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined
          json(res, code === 'ENOENT' ? 404 : 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
        }
      },
    })
    return () => {
      disposeApiRoute()
      disposeStaticRoute()
    }
  }, 'file-explorer: workspace file API')
}

// ---------------------------------------------------------------------------
// Exported for testing
// ---------------------------------------------------------------------------
export { capBytes, createFile, inside, invalidateListCache, list, mkdir, preview, raw, serveStatic, write }
