import { describe, expect, test, beforeAll, afterAll } from 'vitest'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdir, mkdtemp, rm, writeFile, symlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { inside, list, preview, write, raw, apply, capBytes } from '../src/index.ts'
import type { Config } from '../src/protocol.ts'

let root: string

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'dsh-fe-'))
  // Create a directory structure:
  //   root/
  //     subdir/
  //       nested.txt
  //     a.txt
  //     b.txt
  //     .hidden
  //     image.png
  //     empty.txt
  //     binary.bin
  //     big.txt
  //     symlink -> a.txt
  //     escape -> tmpdir() (outside workspace)
  await mkdir(join(root, 'subdir'))
  await writeFile(join(root, 'subdir', 'nested.txt'), 'nested')
  await writeFile(join(root, 'a.txt'), 'hello')
  await writeFile(join(root, 'b.txt'), 'world')
  await writeFile(join(root, '.hidden'), 'secret')
  await writeFile(join(root, 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  await writeFile(join(root, 'empty.txt'), '')
  await writeFile(join(root, 'binary.bin'), Buffer.from([0x00, 0x01, 0x02]))
  // big.txt: 100 bytes for testing too-large with a small cap
  await writeFile(join(root, 'big.txt'), Buffer.alloc(100, 'x'))
  // raw.bin: 200 bytes for testing raw file reads
  await writeFile(join(root, 'raw.bin'), Buffer.alloc(200, (i) => i % 256))
  // PDF fixtures for the pdf action (opened in a new browser tab).
  await writeFile(join(root, 'report.pdf'), Buffer.from('%PDF-1.4\n% test pdf\n'))
  await writeFile(join(root, 'report-upper.PDF'), Buffer.from('%PDF-1.4\n% upper\n'))
  // symlink
  await symlink(join(root, 'a.txt'), join(root, 'symlink'))
  // escape symlink pointing outside the workspace
  await symlink(tmpdir(), join(root, 'escape'))
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// inside
// ---------------------------------------------------------------------------
describe('inside', () => {
  test('resolves empty input to root', async () => {
    const result = await inside(root)
    expect(result.absolute).toBe(join(root, '.'))
    expect(result.path).toBe('')
  })

  test('resolves a relative path within the workspace', async () => {
    const result = await inside(root, 'subdir')
    expect(result.absolute).toBe(join(root, 'subdir'))
    expect(result.path).toBe('subdir')
  })

  test('resolves a nested path within the workspace', async () => {
    const result = await inside(root, 'subdir/nested.txt')
    expect(result.path).toBe('subdir/nested.txt')
  })

  test('rejects ../ escape', async () => {
    await expect(inside(root, '..')).rejects.toThrow('path is outside the configured workspace')
  })

  test('rejects path that escapes via ../', async () => {
    // resolve(root, '../etc') may not exist on disk, so realpath would throw
    // ENOENT rather than the containment error. The important thing is that
    // it rejects the path.
    await expect(inside(root, '../etc')).rejects.toThrow()
  })

  test('rejects absolute path outside workspace', async () => {
    await expect(inside(root, '/etc')).rejects.toThrow('path is outside the configured workspace')
  })

  test('rejects symlink pointing outside workspace', async () => {
    await expect(inside(root, 'escape')).rejects.toThrow('path is outside the configured workspace')
  })
})

// ---------------------------------------------------------------------------
// capBytes
// ---------------------------------------------------------------------------
describe('capBytes', () => {
  test('returns the fallback when value is undefined', () => {
    expect(capBytes(undefined, 64 * 1024)).toBe(64 * 1024)
  })

  test('floors a positive fractional value', () => {
    expect(capBytes(2.9, 64 * 1024)).toBe(2)
  })

  test('keeps a positive integer as-is', () => {
    expect(capBytes(2, 64 * 1024)).toBe(2)
  })

  test('falls back for zero, negative, NaN, and Infinity', () => {
    expect(capBytes(0, 64 * 1024)).toBe(64 * 1024)
    expect(capBytes(-5, 64 * 1024)).toBe(64 * 1024)
    expect(capBytes(NaN, 64 * 1024)).toBe(64 * 1024)
    expect(capBytes(Infinity, 64 * 1024)).toBe(64 * 1024)
  })
})

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------
describe('list', () => {
  test('returns directories before files, sorted alphabetically', async () => {
    const entries = await list(root, '')
    const names = entries.map(e => e.name)
    // subdir must come before files
    const dirIndex = names.indexOf('subdir')
    const aIndex = names.indexOf('a.txt')
    const bIndex = names.indexOf('b.txt')
    expect(dirIndex).toBeLessThan(aIndex)
    expect(dirIndex).toBeLessThan(bIndex)
    // files sorted alphabetically
    expect(aIndex).toBeLessThan(bIndex)
  })

  test('returns correct kinds', async () => {
    const entries = await list(root, '')
    const subdir = entries.find(e => e.name === 'subdir')
    const aFile = entries.find(e => e.name === 'a.txt')
    expect(subdir?.kind).toBe('directory')
    expect(aFile?.kind).toBe('file')
  })

  test('returns file sizes', async () => {
    const entries = await list(root, '')
    const aFile = entries.find(e => e.name === 'a.txt')
    expect(aFile?.size).toBe(5) // 'hello' = 5 bytes
  })

  test('includes hidden entries like .git and node_modules', async () => {
    await mkdir(join(root, 'node_modules'))
    await writeFile(join(root, 'node_modules', 'pkg.json'), '{}')
    await mkdir(join(root, '.git'))
    const entries = await list(root, '')
    const names = entries.map(e => e.name)
    expect(names).toContain('node_modules')
    expect(names).toContain('.git')
    expect(names).toContain('.hidden')
  })

  test('skips symlinks', async () => {
    const entries = await list(root, '')
    const names = entries.map(e => e.name)
    expect(names).not.toContain('symlink')
  })

  test('lists subdirectory contents', async () => {
    const entries = await list(root, 'subdir')
    expect(entries).toHaveLength(1)
    expect(entries[0].name).toBe('nested.txt')
    expect(entries[0].kind).toBe('file')
  })

  test('returns correct path for entries', async () => {
    const entries = await list(root, '')
    const subdir = entries.find(e => e.name === 'subdir')
    expect(subdir?.path).toBe('subdir')
    const aFile = entries.find(e => e.name === 'a.txt')
    expect(aFile?.path).toBe('a.txt')
  })

  test('rejects non-existent path', async () => {
    await expect(list(root, 'nonexistent')).rejects.toThrow()
  })

  test('normalizes path with .. segments', async () => {
    const entries = await list(root, 'subdir/../')
    const names = entries.map(e => e.name)
    expect(names).toContain('a.txt')
    expect(names).toContain('subdir')
  })

  test('rejects symlink pointing outside workspace', async () => {
    await expect(list(root, 'escape')).rejects.toThrow('path is outside the configured workspace')
  })
})

// ---------------------------------------------------------------------------
// preview
// ---------------------------------------------------------------------------
describe('preview', () => {
  test('returns empty for a zero-byte file', async () => {
    const result = await preview(root, 'empty.txt', 1024, 1024)
    expect(result.kind).toBe('empty')
    expect(result.name).toBe('empty.txt')
    expect(result.size).toBe(0)
  })

  test('returns text for a UTF-8 file', async () => {
    const result = await preview(root, 'a.txt', 1024, 1024)
    expect(result.kind).toBe('text')
    expect(result.name).toBe('a.txt')
    expect(result.content).toBe('hello')
    expect(result.size).toBe(5)
  })

  test('returns image with data URL for a PNG file', async () => {
    const result = await preview(root, 'image.png', 1024, 1024)
    expect(result.kind).toBe('image')
    expect(result.name).toBe('image.png')
    expect(result.mime).toBe('image/png')
    expect(result.dataUrl).toMatch(/^data:image\/png;base64,/)
    expect(result.size).toBe(8)
  })

  test('returns binary with hexdump bytes for content with a NUL byte', async () => {
    const result = await preview(root, 'binary.bin', 1024, 1024)
    expect(result.kind).toBe('binary')
    expect(result.name).toBe('binary.bin')
    expect(result.size).toBe(3)
    expect(result.bytes).toBe('AAEC') // [0x00, 0x01, 0x02]
    expect(result.truncated).toBe(false)
  })

  test('returns too-large for a file over the text cap', async () => {
    const result = await preview(root, 'big.txt', 50, 1024)
    expect(result.kind).toBe('too-large')
    expect(result.name).toBe('big.txt')
    expect(result.size).toBe(100)
  })

  test('returns too-large for an image file over the image cap', async () => {
    const result = await preview(root, 'image.png', 1024, 4)
    expect(result.kind).toBe('too-large')
    expect(result.name).toBe('image.png')
    expect(result.size).toBe(8)
  })

  test('mode binary returns binary hexdump bytes for a text file', async () => {
    const result = await preview(root, 'a.txt', 1024, 1024, 'binary')
    expect(result.kind).toBe('binary')
    expect(result.name).toBe('a.txt')
    expect(result.size).toBe(5)
    expect(result.bytes).toBe('aGVsbG8=') // 'hello'
    expect(result.truncated).toBe(false)
  })

  test('mode binary returns empty for a zero-byte file', async () => {
    const result = await preview(root, 'empty.txt', 1024, 1024, 'binary')
    expect(result.kind).toBe('empty')
  })

  test('binary file larger than the text cap returns hexdump, not too-large', async () => {
    // binary.bin is 3 bytes; maxText=2 forces the >cap sniff path.
    const result = await preview(root, 'binary.bin', 2, 1024)
    expect(result.kind).toBe('binary')
    expect(result.bytes).toBe('AAEC')
    expect(result.truncated).toBe(false)
  })

  test('binary preview truncates to the maxBinary cap', async () => {
    const result = await preview(root, 'binary.bin', 1024, 1024, 'auto', 2)
    expect(result.kind).toBe('binary')
    expect(result.bytes).toBe('AAE=') // [0x00, 0x01]
    expect(result.truncated).toBe(true)
  })

  test('mode text reads a binary file as UTF-8 text', async () => {
    const result = await preview(root, 'binary.bin', 1024, 1024, 'text')
    expect(result.kind).toBe('text')
    expect(result.name).toBe('binary.bin')
    expect(result.content).toContain('\u0000')
  })

  test('mode text respects the maxText cap', async () => {
    const result = await preview(root, 'big.txt', 50, 1024, 'text')
    expect(result.kind).toBe('too-large')
  })

  test('rejects when path is a directory', async () => {
    await expect(preview(root, 'subdir', 1024, 1024)).rejects.toThrow('path is not a file')
  })

  test('rejects non-existent path', async () => {
    await expect(preview(root, 'nonexistent', 1024, 1024)).rejects.toThrow()
  })

  test('rejects symlink pointing outside workspace', async () => {
    await expect(preview(root, 'escape', 1024, 1024)).rejects.toThrow('path is outside the configured workspace')
  })
})

// ---------------------------------------------------------------------------
// write
// ---------------------------------------------------------------------------
describe('write', () => {
  test('writes UTF-8 content to a workspace file and returns its path', async () => {
    const saved = await write(root, 'new.txt', 'hello write')
    expect(saved).toBe('new.txt')
    const content = await import('node:fs/promises').then(fs => fs.readFile(join(root, 'new.txt'), 'utf8'))
    expect(content).toBe('hello write')
  })

  test('rejects path escaping the workspace', async () => {
    await expect(write(root, '../outside.txt', 'x')).rejects.toThrow('path is outside the configured workspace')
  })
})

// ---------------------------------------------------------------------------
// raw
// ---------------------------------------------------------------------------
describe('raw', () => {
  test('reads a full file into a buffer', async () => {
    const result = await raw(root, 'raw.bin', 1024 * 1024)
    expect(result.buffer).toBeInstanceOf(Buffer)
    expect(result.buffer.length).toBe(200)
    expect(result.size).toBe(200)
  })

  test('respects the maxRaw cap (truncates to maxRaw)', async () => {
    const result = await raw(root, 'raw.bin', 50)
    expect(result.buffer.length).toBe(50)
    expect(result.size).toBe(200)
  })

  test('reads from an offset', async () => {
    const result = await raw(root, 'raw.bin', 1024 * 1024, { offset: 100 })
    expect(result.buffer.length).toBe(100) // 200 total - 100 offset
    expect(result.size).toBe(200)
  })

  test('reads from offset with limit', async () => {
    const result = await raw(root, 'raw.bin', 1024 * 1024, { offset: 10, limit: 30 })
    expect(result.buffer.length).toBe(30)
    expect(result.size).toBe(200)
  })

  test('limit is clamped to maxRaw', async () => {
    const result = await raw(root, 'raw.bin', 20, { offset: 0, limit: 100 })
    expect(result.buffer.length).toBe(20) // clamped to maxRaw=20
    expect(result.size).toBe(200)
  })

  test('throws for invalid range (offset at file size)', async () => {
    await expect(raw(root, 'raw.bin', 1024 * 1024, { offset: 200 }))
      .rejects.toThrow('invalid range')
  })

  test('throws for invalid range (offset beyond file size)', async () => {
    await expect(raw(root, 'raw.bin', 1024 * 1024, { offset: 300 }))
      .rejects.toThrow('invalid range')
  })

  test('throws for non-existent path', async () => {
    await expect(raw(root, 'nonexistent', 1024)).rejects.toThrow()
  })

  test('throws for a directory path', async () => {
    await expect(raw(root, 'subdir', 1024)).rejects.toThrow('path is not a file')
  })

  test('throws for a path escaping the workspace', async () => {
    await expect(raw(root, 'escape', 1024)).rejects.toThrow('path is outside the configured workspace')
  })
})

// ---------------------------------------------------------------------------
// apply / route handler
// ---------------------------------------------------------------------------
describe('apply / route handler', () => {
  let server: ReturnType<typeof createServer>
  let baseUrl: string
  let routeDisposed: boolean
  let appDisposer: (() => void) | null

  beforeAll(async () => {
    routeDisposed = false
    appDisposer = null
    server = createServer()
    const fakeCtx = {
      sessions: {
        get(id: string) {
          if (id === 'test-session') return { header: { cwd: root } }
          return undefined
        },
      },
      webServer: {
        register(route: { handler: (req: any, res: any) => Promise<void> }) {
          server.on('request', route.handler)
          return () => {
            routeDisposed = true
          }
        },
      },
      effect(cb: () => () => void) {
        appDisposer = cb()
      },
    }
    apply(fakeCtx, {} as Config)
    await new Promise<void>(resolve => server.listen(0, resolve))
    const port = (server.address() as AddressInfo).port
    baseUrl = `http://localhost:${port}`
  })

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()))
  })

  test('list action returns entries', async () => {
    const url = `${baseUrl}/file-explorer/api?sessionId=test-session&action=list&path=`
    const res = await fetch(url)
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.ok).toBe(true)
    expect(body.entries).toBeDefined()
    expect(Array.isArray(body.entries)).toBe(true)
  })

  test('resolve-path action returns path and parentPath', async () => {
    const url = `${baseUrl}/file-explorer/api?sessionId=test-session&action=resolve-path&path=subdir`
    const res = await fetch(url)
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.ok).toBe(true)
    expect(body.path).toBe(join(root, 'subdir'))
    expect(body.parentPath).toBe(dirname(join(root, 'subdir')))
  })

  test('pdf action streams the file with an application/pdf content type', async () => {
    const url = `${baseUrl}/file-explorer/api?sessionId=test-session&action=pdf&path=report.pdf`
    const res = await fetch(url)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toContain('inline')
    const body = Buffer.from(await res.arrayBuffer())
    expect(body.toString('utf8')).toBe('%PDF-1.4\n% test pdf\n')
  })

  test('pdf action matches the extension case-insensitively', async () => {
    const url = `${baseUrl}/file-explorer/api?sessionId=test-session&action=pdf&path=report-upper.PDF`
    const res = await fetch(url)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
  })

  test('pdf action rejects a non-pdf extension', async () => {
    const url = `${baseUrl}/file-explorer/api?sessionId=test-session&action=pdf&path=a.txt`
    const res = await fetch(url)
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.ok).toBe(false)
  })

  test('pdf action rejects a path escaping the workspace', async () => {
    const url = `${baseUrl}/file-explorer/api?sessionId=test-session&action=pdf&path=escape`
    const res = await fetch(url)
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.ok).toBe(false)
  })

  test('pdf action with Range header returns 206 partial content', async () => {
    const url = `${baseUrl}/file-explorer/api?sessionId=test-session&action=pdf&path=report.pdf`
    const res = await fetch(url, { headers: { Range: 'bytes=0-7' } })
    expect(res.status).toBe(206)
    expect(res.headers.get('content-range')).toBe('bytes 0-7/20')
    expect(res.headers.get('accept-ranges')).toBe('bytes')
    const body = Buffer.from(await res.arrayBuffer())
    expect(body.toString('utf8')).toBe('%PDF-1.4')
  })

  test('pdf action with open-ended Range returns 206 to EOF', async () => {
    const url = `${baseUrl}/file-explorer/api?sessionId=test-session&action=pdf&path=report.pdf`
    const res = await fetch(url, { headers: { Range: 'bytes=9-' } })
    expect(res.status).toBe(206)
    expect(res.headers.get('content-range')).toBe('bytes 9-19/20')
    const body = Buffer.from(await res.arrayBuffer())
    expect(body.toString('utf8')).toBe('% test pdf\n')
  })

  test('pdf action returns 416 for out-of-bounds range', async () => {
    const url = `${baseUrl}/file-explorer/api?sessionId=test-session&action=pdf&path=report.pdf`
    const res = await fetch(url, { headers: { Range: 'bytes=500-600' } })
    expect(res.status).toBe(416)
  })

  test('pdf action without Range returns 200 with accept-ranges', async () => {
    const url = `${baseUrl}/file-explorer/api?sessionId=test-session&action=pdf&path=report.pdf`
    const res = await fetch(url)
    expect(res.status).toBe(200)
    expect(res.headers.get('accept-ranges')).toBe('bytes')
  })

  test('raw action returns octet-stream with full file content', async () => {
    const url = `${baseUrl}/file-explorer/api?sessionId=test-session&action=raw&path=raw.bin`
    const res = await fetch(url)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/octet-stream')
    expect(res.headers.get('accept-ranges')).toBe('bytes')
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.length).toBe(200)
  })

  test('raw action with Range header returns 206 partial content', async () => {
    const url = `${baseUrl}/file-explorer/api?sessionId=test-session&action=raw&path=raw.bin`
    const res = await fetch(url, { headers: { Range: 'bytes=0-49' } })
    expect(res.status).toBe(206)
    expect(res.headers.get('content-type')).toBe('application/octet-stream')
    expect(res.headers.get('content-range')).toBe('bytes 0-49/200')
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.length).toBe(50)
  })

  test('raw action with open-ended Range returns 206', async () => {
    const url = `${baseUrl}/file-explorer/api?sessionId=test-session&action=raw&path=raw.bin`
    const res = await fetch(url, { headers: { Range: 'bytes=100-' } })
    expect(res.status).toBe(206)
    expect(res.headers.get('content-range')).toBe('bytes 100-199/200')
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.length).toBe(100)
  })

  test('raw action rejects a path escaping the workspace', async () => {
    const url = `${baseUrl}/file-explorer/api?sessionId=test-session&action=raw&path=escape`
    const res = await fetch(url)
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.ok).toBe(false)
  })

  test('raw action returns 416 for out-of-bounds range', async () => {
    const url = `${baseUrl}/file-explorer/api?sessionId=test-session&action=raw&path=raw.bin`
    const res = await fetch(url, { headers: { Range: 'bytes=500-600' } })
    expect(res.status).toBe(416)
  })

  test('preview action falls back for an invalid maxBinaryBytes config', async () => {
    const server2 = createServer()
    apply(
      {
        sessions: {
          get(id: string) {
            if (id === 'cap-session') return { header: { cwd: root } }
            return undefined
          },
        },
        webServer: {
          register(route: { handler: (req: any, res: any) => Promise<void> }) {
            server2.on('request', route.handler)
            return () => {}
          },
        },
        effect(cb: () => () => void) {
          cb()
        },
      },
      { maxBinaryBytes: -5 } as Config,
    )
    await new Promise<void>((resolve) => server2.listen(0, resolve))
    const port = (server2.address() as AddressInfo).port
    const res = await fetch(`http://localhost:${port}/file-explorer/api?sessionId=cap-session&action=preview&path=binary.bin&mode=binary`)
    const body = await res.json() as any
    expect(body.ok).toBe(true)
    expect(body.preview.kind).toBe('binary')
    expect(body.preview.bytes).toBe('AAEC') // fell back to the default 64 KiB cap
    expect(body.preview.truncated).toBe(false)
    await new Promise<void>((resolve) => server2.close(() => resolve()))
  })

  test('unknown action returns 400', async () => {
    const url = `${baseUrl}/file-explorer/api?sessionId=test-session&action=bogus`
    const res = await fetch(url)
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.ok).toBe(false)
    expect(body.error).toBe('unknown action')
  })

  test('missing sessionId returns 400', async () => {
    const url = `${baseUrl}/file-explorer/api?action=list`
    const res = await fetch(url)
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.ok).toBe(false)
  })

  test('disposer returned by apply calls route disposer', () => {
    expect(appDisposer).toBeDefined()
    expect(routeDisposed).toBe(false)
    appDisposer!()
    expect(routeDisposed).toBe(true)
  })
})