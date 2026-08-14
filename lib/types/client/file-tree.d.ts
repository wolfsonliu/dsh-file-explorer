import React from 'react';
import type { BrowserEntry } from '../protocol.ts';
import type { Translate } from './locale.ts';
import { type FileActionHelpers } from './file-action.ts';
export interface FileTreeProps {
    /** Current session id; undefined means "no session". */
    sessionId: string | undefined;
    /** Action helpers used by the per-row action menu. */
    helpers: FileActionHelpers;
    /** List one directory level (injectable for tests). Returns workspace-relative entries. */
    fetchList: (sessionId: string, path: string) => Promise<BrowserEntry[]>;
    /** Translator for localized UI copy. */
    t: Translate;
}
/** Imperative handle exposed by FileTree. */
export interface FileTreeHandle {
    /** Re-fetch the root and clear cached children. */
    refresh(): void;
}
export declare const FileTree: React.ForwardRefExoticComponent<FileTreeProps & React.RefAttributes<FileTreeHandle>>;
