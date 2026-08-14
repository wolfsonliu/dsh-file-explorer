import type { ComponentType } from 'react'
import type { PreviewProps } from './preview/registry.ts'

export type { PreviewProps } from './preview/registry.ts'
export type { Translate } from './locale.ts'

/**
 * The service `dsh-file-explorer` provides under the name 'fileExplorer'.
 * External preview plugins inject it and call `registerPreview` to contribute
 * a previewer for a file extension, optionally overriding built-in previewers
 * with a higher priority.
 */
export interface FileExplorerService {
  /**
   * Register a preview component for a file extension.
   * @param ext       File extension (lowercase, e.g. 'cif', 'pdb', 'md').
   * @param component Preview component (ComponentType<PreviewProps>).
   * @param priority  Priority (default 0; higher wins; built-ins use 0, an
   *                  overriding external preview uses e.g. 10).
   * @returns disposer that removes this registration (idempotent).
   */
  registerPreview(ext: string, component: ComponentType<PreviewProps>, priority?: number): () => void
}
