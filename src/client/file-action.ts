import type { ReactNode } from 'react'
import type { BrowserEntry } from '../protocol.ts'
import type { Translate } from './locale.ts'

export interface FileActionHelpers {
  openFile(path: string): void
  copyAbsolutePath(path: string): Promise<void>
  copyRelativePath(path: string): Promise<void>
}

export interface FileAction {
  id: string
  /** Display label; a function of the core translator so copy follows locale. */
  label: (t: Translate) => string
  icon?: ReactNode
  /** Which entry kind this action applies to. */
  appliesTo: 'file' | 'directory' | 'both'
  onSelect(entry: BrowserEntry, helpers: FileActionHelpers): void
}

const actions: FileAction[] = []

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

/** Register the built-in file actions, in menu order. */
export function registerBuiltinFileActions(): void {
  registerFileAction({ id: 'open', label: t => t('open'), appliesTo: 'file', onSelect: (entry, h) => { h.openFile(entry.path) } })
  registerFileAction({ id: 'copy-absolute', label: t => t('copyAbsolutePath'), appliesTo: 'both', onSelect: (entry, h) => { void h.copyAbsolutePath(entry.path) } })
  registerFileAction({ id: 'copy-relative', label: t => t('copyRelativePath'), appliesTo: 'both', onSelect: (entry, h) => { void h.copyRelativePath(entry.path) } })
}
