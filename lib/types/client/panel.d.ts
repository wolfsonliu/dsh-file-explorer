import React, { type ReactNode } from 'react';
export interface FileExplorerPanelHandle {
    open: () => void;
    close: () => void;
    toggle: () => void;
}
export interface FileExplorerPanelProps {
    tree: ReactNode;
    preview: ReactNode;
    initialVisible?: boolean;
}
export declare const FileExplorerPanel: React.ForwardRefExoticComponent<FileExplorerPanelProps & React.RefAttributes<FileExplorerPanelHandle>>;
