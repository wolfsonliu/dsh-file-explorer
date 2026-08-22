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

/**
 * Stable sort: directories before files, then by `sort` within each group.
 * Directories have no `size`, so size comparisons fall back to name when
 * either operand is missing; a name tiebreak keeps the order deterministic.
 */
export function sortEntries(
  entries: BrowserEntry[],
  sort: SortSpec = { key: 'name', dir: 'asc' },
): BrowserEntry[] {
  return [...entries].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    let cmp = 0
    if (sort.key === 'size') {
      cmp = (a.size ?? b.size) === undefined
        ? nameCmp(a.name, b.name)
        : (a.size ?? 0) - (b.size ?? 0)
    } else if (sort.key === 'mtime') {
      cmp = (a.mtimeMs ?? 0) - (b.mtimeMs ?? 0)
    } else {
      cmp = nameCmp(a.name, b.name)
    }
    if (cmp === 0) cmp = nameCmp(a.name, b.name)
    return sort.dir === 'asc' ? cmp : -cmp
  })
}