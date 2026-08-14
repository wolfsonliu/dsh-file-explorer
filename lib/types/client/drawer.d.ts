import React, { type ReactNode } from 'react';
export interface FileExplorerDrawerProps {
    open: boolean;
    onClose: () => void;
    /** Optional title text (default '文件浏览器'). */
    title?: string;
    /** The file tree. */
    children: ReactNode;
}
export declare function FileExplorerDrawer({ open, onClose, title, children }: FileExplorerDrawerProps): React.JSX.Element | null;
export declare function FloatingFileButton({ onClick }: {
    onClick: () => void;
}): React.JSX.Element;
