import type { ComponentType } from 'react'
import { registerPreview, resolvePreview, previewKeyOf } from './registry.ts'
import type { PreviewProps } from './registry.ts'
import { TextPreview } from './text.tsx'
import { MarkdownPreview } from './markdown.tsx'
import { ImagePreview } from './image.tsx'
import { BinaryPreview } from './binary.tsx'
import { makeTextPagedPreview } from './text-large.tsx'
import type { ReadRawFile } from './text-large.tsx'
import { makeCsvPreview } from './csv.tsx'
import type { FilePreview } from '../../protocol.ts'

export { TextPreview } from './text.tsx'
export { MarkdownPreview } from './markdown.tsx'
export { ImagePreview } from './image.tsx'
export { BinaryPreview } from './binary.tsx'
export { formatBytes, StatusPreview } from './status.tsx'
export { makeTextPagedPreview } from './text-large.tsx'
export { makeCsvPreview } from './csv.tsx'
export type { ReadRawFile } from './text-large.tsx'

const TEXT_EXTS = [
  'ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html', 'py',
  'yaml', 'yml', 'toml', 'env', 'sh', 'go', 'rs', 'java',
  'c', 'cpp', 'h', 'xml', 'sql', 'graphql', 'cfg', 'ini',
]

const MARKDOWN_EXTS = ['md', 'mdx']
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']

/** Register all built-in preview components. */
export function registerBuiltinPreviews(readRawFile?: ReadRawFile): void {
  for (const ext of TEXT_EXTS) {
    registerPreview(ext, makeTextPagedPreview(readRawFile))
  }
  for (const ext of MARKDOWN_EXTS) {
    registerPreview(ext, MarkdownPreview)
  }
  for (const ext of IMAGE_EXTS) {
    registerPreview(ext, ImagePreview)
  }
  registerPreview('csv', makeCsvPreview(readRawFile))
  registerPreview('binary', BinaryPreview)
}

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
export function resolvePreviewFor(
  preview: FilePreview,
  ext: string,
  readRawFile?: ReadRawFile,
): ComponentType<PreviewProps> {
  if (preview.kind === 'image') return ImagePreview
  if (preview.kind === 'empty') return BinaryPreview
  if (preview.kind === 'text-large') {
    return previewKeyOf(ext) === 'binary' ? makeTextPagedPreview(readRawFile) : resolvePreview(ext)
  }
  if (preview.kind !== 'text') {
    // too-large / binary: route to registered extension component,
    // otherwise fall back to the built-in status page.
    return previewKeyOf(ext) === 'binary' ? BinaryPreview : resolvePreview(ext)
  }
  return previewKeyOf(ext) === 'binary' ? TextPreview : resolvePreview(ext)
}