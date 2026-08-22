import type { BrowserEntry } from '../protocol.ts'

export type SortKey = 'name' | 'size' | 'mtime'
export type SortDir = 'asc' | 'desc'
export interface SortSpec {
  key: SortKey
  dir: SortDir
}

/** Sort-option values backed by the tree toolbar `<select data-fe-sort>`. */
export const SORT_OPTIONS: Array<{ value: string; localeKey: string }> = [
  { value: 'name-asc', localeKey: 'sortNameAsc' },
  { value: 'name-desc', localeKey: 'sortNameDesc' },
  { value: 'size-asc', localeKey: 'sortSizeAsc' },
  { value: 'size-desc', localeKey: 'sortSizeDesc' },
  { value: 'mtime-asc', localeKey: 'sortMtimeAsc' },
  { value: 'mtime-desc', localeKey: 'sortMtimeDesc' },
]

/** Parse a `<select>` option value like "size-desc" into a SortSpec. */
export function parseSort(value: string): SortSpec {
  const dash = value.lastIndexOf('-')
  const dir: SortDir = value.slice(dash + 1) === 'desc' ? 'desc' : 'asc'
  const key = value.slice(0, dash)
  return {
    key: key === 'size' || key === 'mtime' ? key : 'name',
    dir,
  }
}

/** Code-point name comparison, matching the pre-sort default ordering. */
function nameCmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Primary comparison for the given key, before any asc/desc flip. */
function compareKey(a: BrowserEntry, b: BrowserEntry, key: SortKey): number {
  if (key === 'size') {
    if (a.size !== undefined && b.size !== undefined) return a.size - b.size
    return 0 // entries without a size tie, falling through to the name tiebreak
  }
  if (key === 'mtime') return (a.mtimeMs ?? 0) - (b.mtimeMs ?? 0)
  return nameCmp(a.name, b.name)
}

/**
 * Stable sort: directories before files, then by `sort` within each group.
 * The key comparison flips with the direction; the name tiebreak (applied when
 * the key comparison is equal, or when entries have no comparable size) stays
 * ascending for deterministic ordering.
 */
export function sortEntries(
  entries: BrowserEntry[],
  sort: SortSpec = { key: 'name', dir: 'asc' },
): BrowserEntry[] {
  return [...entries].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    const cmp = compareKey(a, b, sort.key)
    if (cmp !== 0) return sort.dir === 'asc' ? cmp : -cmp
    return nameCmp(a.name, b.name)
  })
}
