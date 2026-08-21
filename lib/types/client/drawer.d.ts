import React, { type ReactNode } from 'react';
import type { Translate } from './locale.ts';
export interface FileExplorerDrawerProps {
    open: boolean;
    onClose: () => void;
    /** Optional title text (defaults to the localized title). */
    title?: string;
    /** Called when the refresh button is clicked; button hidden when omitted. */
    onRefresh?: () => void;
    /** Called with the button's bottom-left anchor when "＋ 新建" is clicked. */
    onNew?: (anchor: {
        x: number;
        y: number;
    }) => void;
    /** Translator for localized UI copy. */
    t: Translate;
    /** The file tree. */
    children: ReactNode;
}
export declare function FileExplorerDrawer({ open, onClose, title, onRefresh, onNew, t, children, }: FileExplorerDrawerProps): React.JSX.Element | null;
export declare function FloatingFileButton({ onClick, t, open, }: {
    onClick: () => void;
    t: Translate;
    /** Whether the drawer is expanded; swaps the closed/open folder glyph. */
    open: boolean;
}): React.JSX.Element;
