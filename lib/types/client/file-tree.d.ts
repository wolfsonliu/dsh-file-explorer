import React from 'react';
import type { BrowserEntry } from '../protocol.ts';
export interface FileTreeProps {
    /** Current session id; undefined means "no session". */
    sessionId: string | undefined;
    /** Called when the user clicks a file row. */
    onSelectFile: (path: string) => void;
    /** List one directory level (injectable for tests). Returns workspace-relative entries. */
    fetchList: (sessionId: string, path: string) => Promise<BrowserEntry[]>;
    /** Called when the user right-clicks a file row. */
    onContextMenu?: (entry: BrowserEntry, x: number, y: number) => void;
}
export declare function FileTree({ sessionId, fetchList, onSelectFile, onContextMenu }: FileTreeProps): React.JSX.Element;
