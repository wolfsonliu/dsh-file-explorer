import { describe, expect, test } from 'vitest'
import { matchesSearch, parentPathOf } from '../src/client/tree-search.ts'
import type { BrowserEntry } from '../src/protocol.ts'

describe('matchesSearch', () => {
  test('matches by name, case-insensitively', () => {
    const entry: BrowserEntry = { name: 'README.md', path: 'README.md', kind: 'file' }
    expect(matchesSearch(entry, 'readme')).toBe(true)
    expect(matchesSearch(entry, 'README')).toBe(true)
    expect(matchesSearch(entry, 'me.md')).toBe(true)
  })

  test('matches by a path segment', () => {
    const entry: BrowserEntry = { name: 'index.ts', path: 'src/client/index.ts', kind: 'file' }
    expect(matchesSearch(entry, 'client')).toBe(true)
  })

  test('does not match unrelated text', () => {
    const entry: BrowserEntry = { name: 'README.md', path: 'README.md', kind: 'file' }
    expect(matchesSearch(entry, 'package')).toBe(false)
  })

  test('empty or whitespace query never matches', () => {
    const entry: BrowserEntry = { name: 'a.ts', path: 'a.ts', kind: 'file' }
    expect(matchesSearch(entry, '')).toBe(false)
    expect(matchesSearch(entry, '   ')).toBe(false)
  })
})

describe('parentPathOf', () => {
  test('returns the parent directory of a nested path', () => {
    expect(parentPathOf('src/client/index.ts')).toBe('src/client')
  })

  test('returns an empty string for root-level entries', () => {
    expect(parentPathOf('README.md')).toBe('')
  })

  test('returns the parent for a single nested segment', () => {
    expect(parentPathOf('src/index.ts')).toBe('src')
  })
})