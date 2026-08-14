import type { ComponentType } from 'react';
import type { PreviewProps } from './preview/registry.ts';
import type { FileAction } from './file-action.ts';
export type { PreviewProps } from './preview/registry.ts';
export type { Translate } from './locale.ts';
export type { FileAction, FileActionHelpers } from './file-action.ts';
/**
 * The service `dsh-file-explorer` provides under the name 'fileExplorer'.
 * External plugins inject it to contribute previewers and file-row actions,
 * optionally overriding built-ins with a higher priority.
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
    registerPreview(ext: string, component: ComponentType<PreviewProps>, priority?: number): () => void;
    /**
     * Register a file-row action (appears in the row "···" menu).
     * @param action The action; insertion order = menu order.
     * @returns disposer that removes this registration (idempotent).
     */
    registerFileAction(action: FileAction): () => void;
}
