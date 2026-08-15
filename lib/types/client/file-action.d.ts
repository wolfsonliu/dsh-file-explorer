import type { ReactNode } from 'react';
import type { BrowserEntry } from '../protocol.ts';
import type { Translate } from './locale.ts';
export interface FileActionHelpers {
    openFile(path: string): void;
    openFileAsText(path: string): void;
    openFileAsBinary(path: string): void;
    copyAbsolutePath(path: string): Promise<void>;
    copyRelativePath(path: string): Promise<void>;
}
export interface FileAction {
    id: string;
    /** Display label; a function of the core translator so copy follows locale. */
    label: (t: Translate) => string;
    icon?: ReactNode;
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
