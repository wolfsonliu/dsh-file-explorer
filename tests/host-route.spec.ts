import { describe, expect, test, beforeAll, afterAll } from 'vitest'
import { mkdir, mkdtemp, realpath, rm, writeFile, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { inside, list, preview } from '../src/index.ts'

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
  // symlink
  await symlink(join(root, 'a.txt'), join(root, 'symlink'))
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('inside', () => {
  test('resolves empty input to root', () => {
    const result = inside(root)
    const resolved = join(root, '.')
    expect(result.absolute).toBe(resolved)
    expect(result.path).toBe('')
  })

  test('resolves a relative path within the workspace', () => {
    const result = inside(root, 'subdir')
    expect(result.absolute).toBe(join(root, 'subdir'))
    expect(result.path).toBe('subdir')
  })

  test('resolves a nested path within the workspace', () => {
    const result = inside(root, 'subdir/nested.txt')
    expect(result.path).toBe('subdir/nested.txt')
  })

  test('rejects ../ escape', () => {
    expect(() => inside(root, '..')).toThrow('path is outside the configured workspace')
  })

  test('rejects path that escapes via ../', () => {
    expect(() => inside(root, '../etc')).toThrow('path is outside the configured workspace')
  })

  test('rejects absolute path outside workspace', () => {
    expect(() => inside(root, '/etc')).toThrow('path is outside the configured workspace')
  })
})

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

  test('skips .git and node_modules entries', async () => {
    // Create a node_modules directory to verify it is skipped
    await mkdir(join(root, 'node_modules'))
    await writeFile(join(root, 'node_modules', 'pkg.json'), '{}')
    const entries = await list(root, '')
    const names = entries.map(e => e.name)
    expect(names).not.toContain('node_modules')
    expect(names).not.toContain('.git')
    // .hidden (dotfiles other than .git) are NOT skipped — only .git and node_modules
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
})

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

  test('returns binary for content with a NUL byte', async () => {
    const result = await preview(root, 'binary.bin', 1024, 1024)
    expect(result.kind).toBe('binary')
    expect(result.name).toBe('binary.bin')
    expect(result.size).toBe(3)
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
})