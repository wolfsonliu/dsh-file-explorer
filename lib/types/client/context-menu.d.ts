import React from 'react';
import type { Translate } from './locale.ts';
export interface FileContextMenuProps {
    /** Menu anchor position (viewport coordinates). */
    x: number;
    y: number;
    /** Whether the menu is shown. */
    open: boolean;
    /** The file's full (workspace-relative) path. */
    path: string;
    /** The file's path relative to the workspace root (for "copy relative path"). */
    relativePath: string;
    /** Translator for localized menu item labels. */
    t: Translate;
    onOpen: () => void;
    onCopyPath: () => void;
    onCopyRelativePath: () => void;
    onClose: () => void;
}
export declare function FileContextMenu({ x, y, open, path, relativePath, t, onOpen, onCopyPath, onCopyRelativePath, onClose, }: FileContextMenuProps): React.JSX.Element | null;
