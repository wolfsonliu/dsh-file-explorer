import React from 'react';
import type { BrowserEntry } from '../protocol.ts';
import type { Translate } from './locale.ts';
export interface FileTreeProps {
    /** Current session id; undefined means "no session". */
    sessionId: string | undefined;
    /** Called when the user clicks a file row. */
    onSelectFile: (path: string) => void;
    /** List one directory level (injectable for tests). Returns workspace-relative entries. */
    fetchList: (sessionId: string, path: string) => Promise<BrowserEntry[]>;
    /** Called when the user right-clicks a file row. */
    onContextMenu?: (entry: BrowserEntry, x: number, y: number) => void;
    /** Translator for localized UI copy. */
    t: Translate;
}
/** Imperative handle exposed by FileTree. */
export interface FileTreeHandle {
    /** Re-fetch the root and clear cached children. */
    refresh(): void;
}
export declare const FileTree: React.ForwardRefExoticComponent<FileTreeProps & React.RefAttributes<FileTreeHandle>>;
