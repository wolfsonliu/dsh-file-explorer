import React from 'react';
import type { BrowserEntry, FilePreview } from '../protocol.ts';
export interface FileExplorerAppProps {
    sessionId: string | undefined;
    fetchList: (sessionId: string, path: string) => Promise<BrowserEntry[]>;
    /** Fetch one file's preview (injectable for tests). */
    fetchPreview: (sessionId: string, path: string) => Promise<FilePreview | null>;
}
export interface FileExplorerAppHandle {
    openDrawer(): void;
    closeDrawer(): void;
    toggleDrawer(): void;
    openFile(path: string): void;
}
/** Composes the floating button, left drawer, and floating preview box. */
export declare const FileExplorerApp: React.ForwardRefExoticComponent<FileExplorerAppProps & React.RefAttributes<FileExplorerAppHandle>>;
