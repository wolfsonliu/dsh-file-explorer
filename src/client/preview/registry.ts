import type { ComponentType } from 'react'
import type { FilePreview } from '../../protocol.ts'
import type { Translate } from '../locale.ts'

/** Props every preview component receives. */
export interface PreviewProps {
  preview: FilePreview
  filePath: string
  /** Translator for localized preview status copy (empty/binary/too-large). */
  t: Translate
  onViewSource?: () => void
  activeView: 'preview' | 'source'
}

type PreviewComponent = ComponentType<PreviewProps>

const registry = new Map<string, PreviewComponent>()
const FALLBACK_KEY = 'binary'

/** Register (or replace) the preview component for a file extension. */
export function registerPreview(ext: string, component: PreviewComponent): void {
  registry.set(ext.toLowerCase(), component)
}

/** The registry key for an extension: itself if registered, else the fallback. */
export function previewKeyOf(ext: string): string {
  return registry.has(ext.toLowerCase()) ? ext.toLowerCase() : FALLBACK_KEY
}

/** Resolve the preview component for an extension, falling back to 'binary'. */
export function resolvePreview(ext: string): PreviewComponent {
  return registry.get(previewKeyOf(ext)) ?? registry.get(FALLBACK_KEY)!
}