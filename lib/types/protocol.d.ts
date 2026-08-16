/** Wire protocol shared by host and browser halves. */
export declare const FILE_EXPLORER_ROUTE = "/file-explorer/api";
/** The `action` value that streams a PDF inline for the browser's native viewer. */
export declare const PDF_ACTION = "pdf";
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
}
export type PreviewMode = 'auto' | 'text' | 'binary';
