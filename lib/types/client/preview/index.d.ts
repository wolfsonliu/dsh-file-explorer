import type { ComponentType } from 'react';
import type { PreviewProps } from './registry.ts';
import type { FilePreview } from '../../protocol.ts';
export { TextPreview } from './text.tsx';
export { MarkdownPreview } from './markdown.tsx';
export { ImagePreview } from './image.tsx';
export { BinaryPreview } from './binary.tsx';
export { formatBytes, StatusPreview } from './status.tsx';
/** Register all built-in preview components. */
export declare function registerBuiltinPreviews(): void;
/**
 * Resolve the preview component by the preview's kind, not the extension
 * alone: images use ImagePreview, non-text kinds (empty/binary/too-large) use
 * BinaryPreview, and text kinds use the extension-registered component — or
 * TextPreview when the extension is unregistered (e.g. an extension-less file
 * like LICENSE).
 */
export declare function resolvePreviewFor(preview: FilePreview, ext: string): ComponentType<PreviewProps>;
