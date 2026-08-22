import type { BrowserEntry } from '../protocol.ts';
export type SortKey = 'name' | 'size' | 'mtime';
export type SortDir = 'asc' | 'desc';
export interface SortSpec {
    key: SortKey;
    dir: SortDir;
}
/** Sort-option values backed by the tree toolbar `<select data-fe-sort>`. */
export declare const SORT_OPTIONS: Array<{
    value: string;
    localeKey: string;
}>;
/** Parse a `<select>` option value like "size-desc" into a SortSpec. */
export declare function parseSort(value: string): SortSpec;
/**
 * Stable sort: directories before files, then by `sort` within each group.
 * The key comparison flips with the direction; the name tiebreak (applied when
 * the key comparison is equal, or when entries have no comparable size) stays
 * ascending for deterministic ordering.
 */
export declare function sortEntries(entries: BrowserEntry[], sort?: SortSpec): BrowserEntry[];
