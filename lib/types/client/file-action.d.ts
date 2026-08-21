import type { ReactNode } from 'react';
import type { BrowserEntry } from '../protocol.ts';
import type { Translate } from './locale.ts';
export interface FileActionHelpers {
    openFile(path: string): void;
    openFileAsText(path: string): void;
    openFileAsBinary(path: string): void;
    copyAbsolutePath(path: string): Promise<void>;
    copyRelativePath(path: string): Promise<void>;
    /** Request the app to open the rename input dialog for this entry. */
    promptRename(entry: BrowserEntry): void;
    /** Request the app to open the delete confirmation dialog for this entry. */
    promptDelete(entry: BrowserEntry): void;
    /** Request the app to open the move destination picker for this entry. */
    promptMove(entry: BrowserEntry): void;
    /** Request the app to open the copy destination picker for this entry. */
    promptCopy(entry: BrowserEntry): void;
    /** Request the app to open the new-file input dialog under this directory. */
    promptNewFile(parentDir: string): void;
    /** Request the app to open the new-folder input dialog under this directory. */
    promptNewFolder(parentDir: string): void;
}
export interface FileAction {
    id: string;
    /** Display label; a function of the core translator so copy follows locale. */
    label: (t: Translate) => string;
    icon?: ReactNode;
    /** Render this item with the danger color (e.g. delete). */
    danger?: boolean;
    /** Which entry kind this action applies to. */
    appliesTo: 'file' | 'directory' | 'both';
    onSelect(entry: BrowserEntry, helpers: FileActionHelpers): void;
}
/** Register a file action (insertion order = menu order); returns a disposer. */
export declare function registerFileAction(action: FileAction): () => void;
/** Actions applicable to the given entry kind, in registration order. */
export declare function fileActionsFor(kind: 'file' | 'directory'): FileAction[];
/** Register the built-in file actions, in menu order (idempotent). */
export declare function registerBuiltinFileActions(): void;
