import type { ComponentType } from 'react';
import type { FilePreview } from '../../protocol.ts';
/** Props every preview component receives. */
export interface PreviewProps {
    preview: FilePreview;
    filePath: string;
    onViewSource?: () => void;
    activeView: 'preview' | 'source';
}
type PreviewComponent = ComponentType<PreviewProps>;
/** Register (or replace) the preview component for a file extension. */
export declare function registerPreview(ext: string, component: PreviewComponent): void;
/** The registry key for an extension: itself if registered, else the fallback. */
export declare function previewKeyOf(ext: string): string;
/** Resolve the preview component for an extension, falling back to 'binary'. */
export declare function resolvePreview(ext: string): PreviewComponent;
export {};
