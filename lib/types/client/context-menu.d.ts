import React, { type ReactNode } from 'react';
export interface FileContextMenuItem {
    /** Stable identity for the item (also used as the React key). */
    id: string;
    /** Display label (already localized). */
    label: string;
    /** Optional leading icon. */
    icon?: ReactNode;
    /** Render this item with the danger color. */
    danger?: boolean;
    /** Called when the item is selected (before the menu closes). */
    onSelect: () => void;
}
export interface FileContextMenuProps {
    /** Whether the menu is shown. */
    open: boolean;
    /**
     * Anchor trigger rect supplier, re-read on scroll/resize while open.
     * Return null to skip placement for that frame (keeps the last position).
     */
    getAnchorRect: () => DOMRect | null;
    /** The menu items, in render order. */
    items: Array<FileContextMenuItem>;
    onClose: () => void;
}
/**
 * A generic anchored popup menu listing arbitrary items.
 *
 * Renders into document.body via a portal and fixed-positions itself from the
 * anchor rect, clamped to a 12px viewport margin, re-placing on scroll/resize.
 * Closes on outside pointerdown or Escape.
 */
export declare function FileContextMenu({ open, getAnchorRect, items, onClose }: FileContextMenuProps): React.ReactPortal | null;
