import type { ComponentType } from 'react';
import type { FilePreview } from '../../protocol.ts';
import type { Translate } from '../locale.ts';
/** Props every preview component receives. */
export interface PreviewProps {
    preview: FilePreview;
    filePath: string;
    /** Translator for localized preview status copy (empty/binary/too-large). */
    t: Translate;
    onViewSource?: () => void;
    activeView: 'preview' | 'source';
}
type PreviewComponent = ComponentType<PreviewProps>;
/**
 * Register a preview component for a file extension, returning a disposer that
 * removes this exact entry (idempotently). Higher priority wins at resolution;
 * among equal priorities the later-registered entry wins.
 */
export declare function registerPreview(ext: string, component: PreviewComponent, priority?: number): () => void;
/** The registry key for an extension: itself if registered, else the fallback. */
export declare function previewKeyOf(ext: string): string;
/** Resolve the preview component for an extension, falling back to 'binary'. */
export declare function resolvePreview(ext: string): PreviewComponent;
export {};
