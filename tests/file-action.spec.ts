import { describe, expect, test, vi } from 'vitest'
import type { FileAction, FileActionHelpers } from '../src/client/file-action.tsx'
import { fileActionsFor, registerBuiltinFileActions, registerFileAction } from '../src/client/file-action.tsx'
import { EN, ZH } from '../src/client/locale.ts'
import type { BrowserEntry } from '../src/protocol.ts'

function makeHelpers(): FileActionHelpers {
  return {
    openFile: vi.fn(),
    openFileAsText: vi.fn(),
    openFileAsBinary: vi.fn(),
    copyAbsolutePath: vi.fn(),
    copyRelativePath: vi.fn(),
    promptRename: vi.fn(),
    promptDelete: vi.fn(),
    promptMove: vi.fn(),
    promptCopy: vi.fn(),
    promptNewFile: vi.fn(),
    promptNewFolder: vi.fn(),
  }
}

const fileEntry: BrowserEntry = { name: 'a.ts', path: 'src/a.ts', kind: 'file' }

describe('file-action registry', () => {
  test('registerFileAction returns a disposer that removes the action', () => {
    const action: FileAction = {
      id: 'dispose-me',
      label: () => 'Dispose me',
      appliesTo: 'file',
      onSelect: () => {},
    }
    const dispose = registerFileAction(action)
    expect(fileActionsFor('file').map((a) => a.id)).toContain('dispose-me')

    dispose()
    expect(fileActionsFor('file').map((a) => a.id)).not.toContain('dispose-me')
  })

  test("fileActionsFor('file') returns file/both actions in registration order; directory excludes file-only", () => {
    const fileOnly: FileAction = { id: 'file-only', label: () => 'File', appliesTo: 'file', onSelect: () => {} }
    const both: FileAction = { id: 'both-action', label: () => 'Both', appliesTo: 'both', onSelect: () => {} }
    const dirOnly: FileAction = { id: 'dir-only', label: () => 'Dir', appliesTo: 'directory', onSelect: () => {} }
    const d1 = registerFileAction(fileOnly)
    const d2 = registerFileAction(both)
    const d3 = registerFileAction(dirOnly)

    expect(fileActionsFor('file').map((a) => a.id)).toEqual(['file-only', 'both-action'])
    expect(fileActionsFor('directory').map((a) => a.id)).toEqual(['both-action', 'dir-only'])

    d1()
    d2()
    d3()
  })

  test('registerBuiltinFileActions registers the file/dir actions in menu order', async () => {
    vi.resetModules()
    const mod = await import('../src/client/file-action.tsx')
    mod.registerBuiltinFileActions()

    expect(mod.fileActionsFor('file').map((a) => a.id)).toEqual([
      'open', 'open-as-text', 'open-as-binary', 'copy-absolute', 'copy-relative',
      'rename', 'move', 'copy', 'delete',
    ])
    expect(mod.fileActionsFor('directory').map((a) => a.id)).toEqual([
      'copy-absolute', 'copy-relative', 'rename', 'move', 'copy', 'delete',
      'new-file', 'new-folder',
    ])
  })

  test('built-in actions carry a leading icon in menu order', async () => {
    vi.resetModules()
    const mod = await import('../src/client/file-action.tsx')
    mod.registerBuiltinFileActions()

    const file = mod.fileActionsFor('file')
    const dir = mod.fileActionsFor('directory')
    const seen = new Map<string, typeof file[0]>()
    for (const action of file) seen.set(action.id, action)
    for (const action of dir) if (!seen.has(action.id)) seen.set(action.id, action)

    // Every built-in action renders an icon.
    for (const action of seen.values()) {
      expect(action.icon).toBeTruthy()
    }
    // Delete is the destructive action.
    expect(seen.get('delete')!.danger).toBe(true)
  })

  test('built-in actions invoke the correct helper', async () => {
    vi.resetModules()
    const mod = await import('../src/client/file-action.tsx')
    mod.registerBuiltinFileActions()
    const byId = new Map(mod.fileActionsFor('file').map((a) => [a.id, a]))

    const helpers = makeHelpers()
    byId.get('open')!.onSelect(fileEntry, helpers)
    expect(helpers.openFile).toHaveBeenCalledWith('src/a.ts')
    expect(helpers.copyAbsolutePath).not.toHaveBeenCalled()
    expect(helpers.copyRelativePath).not.toHaveBeenCalled()

    byId.get('open-as-text')!.onSelect(fileEntry, helpers)
    expect(helpers.openFileAsText).toHaveBeenCalledWith('src/a.ts')

    byId.get('open-as-binary')!.onSelect(fileEntry, helpers)
    expect(helpers.openFileAsBinary).toHaveBeenCalledWith('src/a.ts')

    byId.get('copy-absolute')!.onSelect(fileEntry, helpers)
    expect(helpers.copyAbsolutePath).toHaveBeenCalledWith('src/a.ts')

    byId.get('copy-relative')!.onSelect(fileEntry, helpers)
    expect(helpers.copyRelativePath).toHaveBeenCalledWith('src/a.ts')
  })
})

describe('locale', () => {
  test('ZH and EN both define copyAbsolutePath', () => {
    expect(ZH.copyAbsolutePath).toBe('复制绝对路径')
    expect(EN.copyAbsolutePath).toBe('Copy absolute path')
  })
})
