import React, { type ReactNode } from 'react';
export interface FileExplorerPanelHandle {
    open: () => void;
    close: () => void;
    toggle: () => void;
}
export interface FileExplorerPanelProps {
    /** Optional title text (default '文件浏览器'). */
    title?: string;
    /** Preview content rendered in the body. */
    children: ReactNode;
    initialVisible?: boolean;
}
export declare const FileExplorerPanel: React.ForwardRefExoticComponent<FileExplorerPanelProps & React.RefAttributes<FileExplorerPanelHandle>>;
