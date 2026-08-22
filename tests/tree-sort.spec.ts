import { describe, expect, test } from 'vitest'
import { parseSort, sortEntries } from '../src/client/tree-sort.ts'
import type { BrowserEntry } from '../src/protocol.ts'

const entries: BrowserEntry[] = [
  { name: 'b.txt', path: 'b.txt', kind: 'file', size: 10, mtimeMs: 300 },
  { name: 'a.txt', path: 'a.txt', kind: 'file', size: 100, mtimeMs: 100 },
  { name: 'dir', path: 'dir', kind: 'directory', mtimeMs: 200 },
]

describe('sortEntries', () => {
  test('default sorts directories first then name ascending', () => {
    expect(sortEntries(entries).map(e => e.name)).toEqual(['dir', 'a.txt', 'b.txt'])
  })

  test('name descending reverses files within the directory group', () => {
    expect(sortEntries(entries, { key: 'name', dir: 'desc' }).map(e => e.name)).toEqual(['dir', 'b.txt', 'a.txt'])
  })

  test('size descending orders files by size', () => {
    expect(sortEntries(entries, { key: 'size', dir: 'desc' }).map(e => e.name)).toEqual(['dir', 'a.txt', 'b.txt'])
  })

  test('size ascending orders files smallest first', () => {
    expect(sortEntries(entries, { key: 'size', dir: 'asc' }).map(e => e.name)).toEqual(['dir', 'b.txt', 'a.txt'])
  })

  test('mtime descending orders directories by newest first', () => {
    const dirs: BrowserEntry[] = [
      { name: 'd1', path: 'd1', kind: 'directory', mtimeMs: 100 },
      { name: 'd2', path: 'd2', kind: 'directory', mtimeMs: 500 },
    ]
    expect(sortEntries(dirs, { key: 'mtime', dir: 'desc' }).map(e => e.name)).toEqual(['d2', 'd1'])
  })

  test('does not mutate the input array', () => {
    const copy = [...entries]
    sortEntries(entries, { key: 'size', dir: 'desc' })
    expect(entries).toEqual(copy)
  })
})

describe('parseSort', () => {
  test('parses option values and falls back to name/asc for junk', () => {
    expect(parseSort('size-desc')).toEqual({ key: 'size', dir: 'desc' })
    expect(parseSort('mtime-asc')).toEqual({ key: 'mtime', dir: 'asc' })
    expect(parseSort('garbage-x')).toEqual({ key: 'name', dir: 'asc' })
  })
})