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
    /** Menu anchor position (viewport coordinates). */
    anchor: {
        x: number;
        y: number;
    };
    /** The menu items, in render order. */
    items: Array<FileContextMenuItem>;
    onClose: () => void;
}
/** A generic anchored popup menu listing arbitrary items. */
export declare function FileContextMenu({ open, anchor, items, onClose }: FileContextMenuProps): React.JSX.Element | null;
