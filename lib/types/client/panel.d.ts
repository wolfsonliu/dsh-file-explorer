import React, { type ReactNode } from 'react';
import type { Translate } from './locale.ts';
export interface FileExplorerPanelHandle {
    open: () => void;
    close: () => void;
    toggle: () => void;
}
export interface FileExplorerPanelProps {
    /** Optional title text (defaults to the localized title). */
    title?: string;
    /** Translator for localized UI copy. */
    t: Translate;
    /** Preview content rendered in the body. */
    children: ReactNode;
    initialVisible?: boolean;
}
export declare const FileExplorerPanel: React.ForwardRefExoticComponent<FileExplorerPanelProps & React.RefAttributes<FileExplorerPanelHandle>>;
