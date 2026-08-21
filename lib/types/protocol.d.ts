/** Wire protocol shared by host and browser halves. */
export declare const FILE_EXPLORER_ROUTE = "/file-explorer/api";
/** The `action` value that streams a PDF inline for the browser's native viewer. */
export declare const PDF_ACTION = "pdf";
/** Prefix route that serves workspace files for browser-native rendering. */
export declare const STATIC_FILES_ROUTE = "/file-explorer/files";
/** Extensions the client opens in a new browser tab on default open. */
export declare const BROWSER_OPEN_EXTS: readonly ["pdf", "html", "htm", "xhtml"];
/** Mutation actions for the file-ops feature (all POST, workspace-contained). */
export declare const CREATE_FILE_ACTION = "create-file";
export declare const MKDIR_ACTION = "mkdir";
export declare const RENAME_ACTION = "rename";
export declare const MOVE_ACTION = "move";
export declare const COPY_ACTION = "copy";
export declare const DELETE_ACTION = "delete";
export interface BrowserEntry {
    name: string;
    /** Workspace-relative path ('' = root). */
    path: string;
    kind: 'file' | 'directory';
    size?: number;
}
export type FilePreview = {
    kind: 'text';
    name: string;
    extension: string;
    content: string;
    size: number;
} | {
    kind: 'image';
    name: string;
    mime: string;
    dataUrl: string;
    size: number;
} | {
    kind: 'empty';
    name: string;
    size: 0;
} | {
    kind: 'binary';
    name: string;
    size: number;
    bytes: string;
    truncated: boolean;
} | {
    kind: 'text-large';
    name: string;
    extension: string;
    size: number;
} | {
    kind: 'too-large';
    name: string;
    size: number;
};
export type ApiResponse = {
    ok: true;
    root: string;
    entries: BrowserEntry[];
} | {
    ok: true;
    preview: FilePreview;
} | {
    ok: true;
    path: string;
    parentPath: string;
} | {
    ok: true;
    path: string;
} | {
    ok: true;
    saved: string;
} | {
    ok: false;
    error: string;
};
export interface Config {
    /** Single text-file read cap in bytes (default 2 MiB). */
    maxTextBytes?: number;
    /** Single image-file read cap in bytes (default 10 MiB). */
    maxImageBytes?: number;
    /** Single binary-file hexdump read cap in bytes (default 64 KiB). */
    maxBinaryBytes?: number;
    /** Per-read cap for raw file reads (default 100 MiB). Limits each
     *  readRawFile call, not the total file size. */
    maxRawBytes?: number;
    /** When true, dot-prefixed files/directories are listed (default false = hide). */
    showHidden?: boolean;
    /** Optional Content-Security-Policy value for inline `text/html`,
     *  `application/xhtml+xml`, and `image/svg+xml` responses from the
     *  `/file-explorer/files` route. Empty/undefined = no header (default). */
    inlineCsp?: string;
}
export type PreviewMode = 'auto' | 'text' | 'binary';
