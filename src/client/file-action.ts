import type { ReactNode } from 'react'
import type { BrowserEntry } from '../protocol.ts'
import type { Translate } from './locale.ts'

export interface FileActionHelpers {
  openFile(path: string): void
  openFileAsText(path: string): void
  openFileAsBinary(path: string): void
  copyAbsolutePath(path: string): Promise<void>
  copyRelativePath(path: string): Promise<void>
  /** Request the app to open the rename input dialog for this entry. */
  promptRename(entry: BrowserEntry): void
  /** Request the app to open the delete confirmation dialog for this entry. */
  promptDelete(entry: BrowserEntry): void
  /** Request the app to open the move destination picker for this entry. */
  promptMove(entry: BrowserEntry): void
  /** Request the app to open the copy destination picker for this entry. */
  promptCopy(entry: BrowserEntry): void
  /** Request the app to open the new-file input dialog under this directory. */
  promptNewFile(parentDir: string): void
  /** Request the app to open the new-folder input dialog under this directory. */
  promptNewFolder(parentDir: string): void
}

export interface FileAction {
  id: string
  /** Display label; a function of the core translator so copy follows locale. */
  label: (t: Translate) => string
  icon?: ReactNode
  /** Render this item with the danger color (e.g. delete). */
  danger?: boolean
  /** Which entry kind this action applies to. */
  appliesTo: 'file' | 'directory' | 'both'
  onSelect(entry: BrowserEntry, helpers: FileActionHelpers): void
}

const actions: FileAction[] = []
let builtinsRegistered = false

/** Register a file action (insertion order = menu order); returns a disposer. */
export function registerFileAction(action: FileAction): () => void {
  actions.push(action)
  return () => {
    const i = actions.indexOf(action)
    if (i >= 0) actions.splice(i, 1)
  }
}

/** Actions applicable to the given entry kind, in registration order. */
export function fileActionsFor(kind: 'file' | 'directory'): FileAction[] {
  return actions.filter(a => a.appliesTo === kind || a.appliesTo === 'both')
}

/** Register the built-in file actions, in menu order (idempotent). */
export function registerBuiltinFileActions(): void {
  if (builtinsRegistered) return
  builtinsRegistered = true
  registerFileAction({ id: 'open', label: t => t('open'), appliesTo: 'file', onSelect: (entry, h) => { h.openFile(entry.path) } })
  registerFileAction({ id: 'open-as-text', label: t => t('openAsText'), appliesTo: 'file', onSelect: (entry, h) => { h.openFileAsText(entry.path) } })
  registerFileAction({ id: 'open-as-binary', label: t => t('openAsBinary'), appliesTo: 'file', onSelect: (entry, h) => { h.openFileAsBinary(entry.path) } })
  registerFileAction({ id: 'copy-absolute', label: t => t('copyAbsolutePath'), appliesTo: 'both', onSelect: (entry, h) => { void h.copyAbsolutePath(entry.path) } })
  registerFileAction({ id: 'copy-relative', label: t => t('copyRelativePath'), appliesTo: 'both', onSelect: (entry, h) => { void h.copyRelativePath(entry.path) } })
  registerFileAction({ id: 'rename', label: t => t('rename'), appliesTo: 'both', onSelect: (entry, h) => { h.promptRename(entry) } })
  registerFileAction({ id: 'move', label: t => t('moveTo'), appliesTo: 'both', onSelect: (entry, h) => { h.promptMove(entry) } })
  registerFileAction({ id: 'copy', label: t => t('copyTo'), appliesTo: 'both', onSelect: (entry, h) => { h.promptCopy(entry) } })
  registerFileAction({ id: 'delete', label: t => t('delete'), appliesTo: 'both', danger: true, onSelect: (entry, h) => { h.promptDelete(entry) } })
  registerFileAction({ id: 'new-file', label: t => t('newFile'), appliesTo: 'directory', onSelect: (entry, h) => { h.promptNewFile(entry.path) } })
  registerFileAction({ id: 'new-folder', label: t => t('newFolder'), appliesTo: 'directory', onSelect: (entry, h) => { h.promptNewFolder(entry.path) } })
}
