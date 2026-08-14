import { registerPreview } from './registry.ts'
import { TextPreview } from './text.tsx'
import { MarkdownPreview } from './markdown.tsx'
import { ImagePreview } from './image.tsx'
import { BinaryPreview } from './binary.tsx'

export { TextPreview } from './text.tsx'
export { MarkdownPreview } from './markdown.tsx'
export { ImagePreview } from './image.tsx'
export { BinaryPreview } from './binary.tsx'
export { formatBytes, StatusPreview } from './status.tsx'

const TEXT_EXTS = [
  'ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html', 'py',
  'yaml', 'yml', 'toml', 'env', 'sh', 'go', 'rs', 'java',
  'c', 'cpp', 'h', 'xml', 'sql', 'graphql', 'cfg', 'ini',
]

const MARKDOWN_EXTS = ['md', 'mdx']
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']

/** Register all built-in preview components. */
export function registerBuiltinPreviews(): void {
  for (const ext of TEXT_EXTS) {
    registerPreview(ext, TextPreview)
  }
  for (const ext of MARKDOWN_EXTS) {
    registerPreview(ext, MarkdownPreview)
  }
  for (const ext of IMAGE_EXTS) {
    registerPreview(ext, ImagePreview)
  }
  registerPreview('binary', BinaryPreview)
}