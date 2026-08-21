import type { BrowserEntry } from '../protocol.ts'

/** The in-flight file operation the modal renders; 'idle' means no dialog. */
export type FileOp =
  | { kind: 'idle' }
  | { kind: 'rename'; entry: BrowserEntry }
  | { kind: 'new-file'; parentDir: string }
  | { kind: 'new-folder'; parentDir: string }
  | { kind: 'delete'; entry: BrowserEntry }
  | { kind: 'move'; entry: BrowserEntry }
  | { kind: 'copy'; entry: BrowserEntry }

/** Workspace mutation API the modal and app call (post to host actions). */
export interface FileOps {
  createFile(path: string): Promise<void>
  createDir(path: string): Promise<void>
  rename(path: string, name: string): Promise<void>
  remove(path: string): Promise<void>
  move(path: string, toDir: string): Promise<void>
  copy(path: string, toDir: string): Promise<void>
}

/** Join a parent directory path ('' = root) with a single name segment. */
export function joinRel(parentDir: string, name: string): string {
  return parentDir === '' ? name : `${parentDir}/${name}`
}

/** The final path segment of a workspace-relative path. */
export function basenameOfRel(path: string): string {
  return path.split('/').at(-1) ?? path
}