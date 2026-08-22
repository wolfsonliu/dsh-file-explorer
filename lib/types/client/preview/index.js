import { registerPreview, resolvePreview, previewKeyOf } from "./registry.js";
import { TextPreview } from "./text.js";
import { MarkdownPreview } from "./markdown.js";
import { ImagePreview } from "./image.js";
import { BinaryPreview } from "./binary.js";
import { makeTextPagedPreview } from "./text-large.js";
import { makeCsvPreview } from "./csv.js";
export { TextPreview } from "./text.js";
export { MarkdownPreview } from "./markdown.js";
export { ImagePreview } from "./image.js";
export { BinaryPreview } from "./binary.js";
export { formatBytes, StatusPreview } from "./status.js";
export { makeTextPagedPreview } from "./text-large.js";
export { makeCsvPreview } from "./csv.js";
const TEXT_EXTS = [
    'ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html', 'py',
    'yaml', 'yml', 'toml', 'env', 'sh', 'go', 'rs', 'java',
    'c', 'cpp', 'h', 'xml', 'sql', 'graphql', 'cfg', 'ini',
];
const MARKDOWN_EXTS = ['md', 'mdx'];
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
/** Register all built-in preview components. */
export function registerBuiltinPreviews(readRawFile) {
    for (const ext of TEXT_EXTS) {
        registerPreview(ext, makeTextPagedPreview(readRawFile));
    }
    for (const ext of MARKDOWN_EXTS) {
        registerPreview(ext, MarkdownPreview);
    }
    for (const ext of IMAGE_EXTS) {
        registerPreview(ext, ImagePreview);
    }
    registerPreview('csv', makeCsvPreview(readRawFile));
    registerPreview('binary', BinaryPreview);
}
/**
 * Resolve the preview component by the preview's kind: images route to the
 * extension-registered component, or fall back to ImagePreview when the
 * extension is unregistered; empty files always use BinaryPreview; non-text
 * kinds (binary/too-large) route to the extension-registered component — or
 * fall back to BinaryPreview when the extension is unregistered. Large text
 * files (`text-large`) route to the paged text renderer for unregistered
 * extensions, or to the extension-registered component when one exists. Text
 * kinds use the extension-registered component, or TextPreview when the
 * extension is unregistered (e.g. an extension-less file like LICENSE).
 */
export function resolvePreviewFor(preview, ext, readRawFile) {
    if (preview.kind === 'image') {
        return previewKeyOf(ext) === 'binary' ? ImagePreview : resolvePreview(ext);
    }
    if (preview.kind === 'empty')
        return BinaryPreview;
    if (preview.kind === 'text-large') {
        return previewKeyOf(ext) === 'binary' ? makeTextPagedPreview(readRawFile) : resolvePreview(ext);
    }
    if (preview.kind !== 'text') {
        // too-large / binary: route to registered extension component,
        // otherwise fall back to the built-in status page.
        return previewKeyOf(ext) === 'binary' ? BinaryPreview : resolvePreview(ext);
    }
    return previewKeyOf(ext) === 'binary' ? TextPreview : resolvePreview(ext);
}
