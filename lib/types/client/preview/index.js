import { registerPreview } from "./registry.js";
import { TextPreview } from "./text.js";
import { MarkdownPreview } from "./markdown.js";
import { ImagePreview } from "./image.js";
import { BinaryPreview } from "./binary.js";
export { TextPreview } from "./text.js";
export { MarkdownPreview } from "./markdown.js";
export { ImagePreview } from "./image.js";
export { BinaryPreview } from "./binary.js";
export { formatBytes, StatusPreview } from "./status.js";
const TEXT_EXTS = [
    'ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html', 'py',
    'yaml', 'yml', 'toml', 'env', 'sh', 'go', 'rs', 'java',
    'c', 'cpp', 'h', 'xml', 'sql', 'graphql', 'cfg', 'ini',
];
const MARKDOWN_EXTS = ['md', 'mdx'];
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
/** Register all built-in preview components. */
export function registerBuiltinPreviews() {
    for (const ext of TEXT_EXTS) {
        registerPreview(ext, TextPreview);
    }
    for (const ext of MARKDOWN_EXTS) {
        registerPreview(ext, MarkdownPreview);
    }
    for (const ext of IMAGE_EXTS) {
        registerPreview(ext, ImagePreview);
    }
    registerPreview('binary', BinaryPreview);
}
