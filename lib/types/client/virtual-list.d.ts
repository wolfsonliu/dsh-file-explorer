import type { ReactNode } from 'react';
export interface VirtualListProps {
    rowCount: number;
    /** Constant height, or a per-row heights array (index-aligned with rows). */
    rowHeight: number | readonly number[];
    /** Stable identity per row index (used as the React key). */
    rowKey: (index: number) => string | number;
    /** Extra rows rendered above/below the visible viewport. */
    overscan?: number;
    className?: string;
    renderRow: (index: number) => ReactNode;
}
export declare function VirtualList({ rowCount, rowHeight, rowKey, overscan, className, renderRow, }: VirtualListProps): import("react").JSX.Element;
