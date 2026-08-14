/**
 * DSH-style inline SVG icons for the file-explorer plugin.
 *
 * An external plugin cannot import `@deepseek-ai/dsh-client-ui-primitives`, so
 * the SVG path data is inlined from DSH's own icon components (see dsh-source).
 * Every glyph renders fill="currentColor" and takes { size, className, style }.
 */
import type { CSSProperties } from 'react';
export interface FeIconProps {
    size?: number;
    className?: string;
    style?: CSSProperties;
}
/** ic_ds_panel_left_outline_16 — inlined from `IconPanelLeftOutline16`. */
export declare function IconPanelLeft(props: FeIconProps): import("react").JSX.Element;
/** ic_ds_close_outline_16 — inlined from `IconCloseOutline16`. */
export declare function IconClose(props: FeIconProps): import("react").JSX.Element;
/** folder_open_16 — inlined from `IconFolderOpen16`. */
export declare function IconFolderOpen(props: FeIconProps): import("react").JSX.Element;
/** folder_close_16 — inlined from `IconFolderClose16`. */
export declare function IconFolderClose(props: FeIconProps): import("react").JSX.Element;
/** ic_ds_chevron_right_outline_14 — inlined from `IconChevronRightOutline14`. */
export declare function IconChevronRight(props: FeIconProps): import("react").JSX.Element;
/** ic_ds_refresh_outline_16 — inlined from `IconRefreshOutline16`. */
export declare function IconRefresh(props: FeIconProps): import("react").JSX.Element;
/** ic_ds_copy_outline_16 — inlined from `IconCopyOutline16`. */
export declare function IconCopy(props: FeIconProps): import("react").JSX.Element;
/** ic_ds_fullscreen_outline_16 — inlined from `IconFullscreenOutline16`. */
export declare function IconFullscreen(props: FeIconProps): import("react").JSX.Element;
/** generic_file_16 — simple document outline with a folded top-right corner. */
export declare function IconFile(props: FeIconProps): import("react").JSX.Element;
/** ic_ds_ellipsis_outline_16 — inlined from `IconEllipsisOutline16`. */
export declare function IconEllipsis(props: FeIconProps): import("react").JSX.Element;
