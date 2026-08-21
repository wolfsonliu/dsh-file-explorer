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
    /** Called synchronously just before the panel is closed via the close button. */
    onClose?: () => void;
}
export interface Position {
    x: number;
    y: number;
}
export interface Size {
    width: number;
    height: number;
}
/** 标题栏高度；必须与 styles.ts 的 `.dsh-fe-title-bar { height: 32px }` 保持一致。 */
export declare const TITLE_BAR_HEIGHT = 32;
export interface Viewport {
    width: number;
    height: number;
}
/** 把面板位置钳制到视口内，保证 32px 标题栏始终完整可见。 */
export declare function clampToViewport(position: Position, size: Size, viewport: Viewport): Position;
export declare const FileExplorerPanel: React.ForwardRefExoticComponent<FileExplorerPanelProps & React.RefAttributes<FileExplorerPanelHandle>>;
