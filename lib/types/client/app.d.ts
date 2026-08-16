import React from 'react';
import { type BrowserEntry, type FilePreview, type PreviewMode } from '../protocol.ts';
import type { Translate } from './locale.ts';
export interface FileExplorerAppProps {
    sessionId: string | undefined;
    fetchList: (sessionId: string, path: string) => Promise<BrowserEntry[]>;
    /** Fetch one file's preview (injectable for tests). */
    fetchPreview: (sessionId: string, path: string, mode?: PreviewMode) => Promise<FilePreview | null>;
    /** Translator for localized UI copy. */
    t: Translate;
    /** Write a file back (injectable for tests); enables built-in markdown editing. */
    writeFile?: (path: string, content: string) => Promise<void>;
}
export interface FileExplorerAppHandle {
    openDrawer(): void;
    closeDrawer(): void;
    toggleDrawer(): void;
    openFile(path: string): void;
}
/** Composes the floating button, left drawer, and floating preview box. */
export declare const FileExplorerApp: React.ForwardRefExoticComponent<FileExplorerAppProps & React.RefAttributes<FileExplorerAppHandle>>;
