import type { BrowserEntry } from '../protocol.ts';
/** Case-insensitive substring match against an entry's name or workspace-relative path. */
export declare function matchesSearch(entry: BrowserEntry, query: string): boolean;
/** Parent directory of a workspace-relative path ('' for root-level entries). */
export declare function parentPathOf(path: string): string;
