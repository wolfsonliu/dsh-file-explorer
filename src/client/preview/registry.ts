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

interface PreviewEntry {
  component: PreviewComponent
  priority: number
}

const registry = new Map<string, PreviewEntry[]>()
const FALLBACK_KEY = 'binary'

/**
 * Register a preview component for a file extension, returning a disposer that
 * removes this exact entry (idempotently). Higher priority wins at resolution;
 * among equal priorities the later-registered entry wins.
 */
export function registerPreview(
  ext: string,
  component: PreviewComponent,
  priority = 0,
): () => void {
  const key = ext.toLowerCase()
  const entries = registry.get(key) ?? []
  const entry: PreviewEntry = { component, priority }
  entries.push(entry)
  registry.set(key, entries)

  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    const remaining = entries.filter((e) => e !== entry)
    if (remaining.length === 0) {
      registry.delete(key)
    } else {
      registry.set(key, remaining)
    }
  }
}

/** The registry key for an extension: itself if registered, else the fallback. */
export function previewKeyOf(ext: string): string {
  return registry.has(ext.toLowerCase()) ? ext.toLowerCase() : FALLBACK_KEY
}

/** The highest-priority entry for a key, or null when it has no entries. */
function highestPriority(key: string): PreviewEntry | null {
  const entries = registry.get(key)
  if (!entries || entries.length === 0) return null
  let best = entries[0]
  for (const entry of entries) {
    if (entry.priority >= best.priority) best = entry
  }
  return best
}

/** Resolve the preview component for an extension, falling back to 'binary'. */
export function resolvePreview(ext: string): PreviewComponent {
  const key = previewKeyOf(ext)
  const entry = highestPriority(key) ?? highestPriority(FALLBACK_KEY)
  return entry!.component
}