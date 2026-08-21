/** Wire protocol shared by host and browser halves. */
export const FILE_EXPLORER_ROUTE = '/file-explorer/api';
/** The `action` value that streams a PDF inline for the browser's native viewer. */
export const PDF_ACTION = 'pdf';
/** Prefix route that serves workspace files for browser-native rendering. */
export const STATIC_FILES_ROUTE = '/file-explorer/files';
/** Extensions the client opens in a new browser tab on default open. */
export const BROWSER_OPEN_EXTS = ['pdf', 'html', 'htm', 'xhtml'];
/** Mutation actions for the file-ops feature (all POST, workspace-contained). */
export const CREATE_FILE_ACTION = 'create-file';
export const MKDIR_ACTION = 'mkdir';
export const RENAME_ACTION = 'rename';
export const MOVE_ACTION = 'move';
export const COPY_ACTION = 'copy';
export const DELETE_ACTION = 'delete';
