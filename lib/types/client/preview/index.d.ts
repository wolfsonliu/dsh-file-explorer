import type { ComponentType } from 'react';
import type { PreviewProps } from './registry.ts';
import type { ReadRawFile } from './text-large.tsx';
import type { FilePreview } from '../../protocol.ts';
export { TextPreview } from './text.tsx';
export { MarkdownPreview } from './markdown.tsx';
export { ImagePreview } from './image.tsx';
export { BinaryPreview } from './binary.tsx';
export { formatBytes, StatusPreview } from './status.tsx';
export { makeTextPagedPreview } from './text-large.tsx';
export type { ReadRawFile } from './text-large.tsx';
/** Register all built-in preview components. */
export declare function registerBuiltinPreviews(readRawFile?: ReadRawFile): void;
/**
 * Resolve the preview component by the preview's kind: images use
 * ImagePreview, empty files always use BinaryPreview, and non-text kinds
 * (binary/too-large) route to the extension-registered component — or fall
 * back to BinaryPreview when the extension is unregistered. Large text files
 * (`text-large`) route to the paged text renderer for unregistered
 * extensions, or to the extension-registered component when one exists. Text
 * kinds use the extension-registered component, or TextPreview when the
 * extension is unregistered (e.g. an extension-less file like LICENSE).
 */
export declare function resolvePreviewFor(preview: FilePreview, ext: string, readRawFile?: ReadRawFile): ComponentType<PreviewProps>;
