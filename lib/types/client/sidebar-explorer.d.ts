import React from 'react';
import type { BrowserEntry } from '../protocol.ts';
export interface SidebarExplorerProps {
    sessionId: string | undefined;
    fetchList: (sessionId: string, path: string) => Promise<BrowserEntry[]>;
    onSelectFile: (path: string) => void;
}
export interface SidebarExplorerHandle {
    showFiles(): void;
    showSessions(): void;
}
/** Sidebar tab bar (「会话 / 文件」) plus the overlay file tree. */
export declare const SidebarExplorer: React.ForwardRefExoticComponent<SidebarExplorerProps & React.RefAttributes<SidebarExplorerHandle>>;
