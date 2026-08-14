import { describe, expect, test, vi } from 'vitest'
import type { FileAction, FileActionHelpers } from '../src/client/file-action.ts'
import { fileActionsFor, registerBuiltinFileActions, registerFileAction } from '../src/client/file-action.ts'
import { EN, ZH } from '../src/client/locale.ts'
import type { BrowserEntry } from '../src/protocol.ts'

function makeHelpers(): FileActionHelpers {
  return {
    openFile: vi.fn(),
    copyAbsolutePath: vi.fn(),
    copyRelativePath: vi.fn(),
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

  test('registerBuiltinFileActions registers open, copy-absolute, copy-relative in order', async () => {
    vi.resetModules()
    const mod = await import('../src/client/file-action.ts')
    mod.registerBuiltinFileActions()

    expect(mod.fileActionsFor('file').map((a) => a.id)).toEqual(['open', 'copy-absolute', 'copy-relative'])
    expect(mod.fileActionsFor('directory').map((a) => a.id)).toEqual(['copy-absolute', 'copy-relative'])
  })

  test('built-in actions invoke the correct helper', async () => {
    vi.resetModules()
    const mod = await import('../src/client/file-action.ts')
    mod.registerBuiltinFileActions()
    const byId = new Map(mod.fileActionsFor('file').map((a) => [a.id, a]))

    const helpers = makeHelpers()
    byId.get('open')!.onSelect(fileEntry, helpers)
    expect(helpers.openFile).toHaveBeenCalledWith('src/a.ts')
    expect(helpers.copyAbsolutePath).not.toHaveBeenCalled()
    expect(helpers.copyRelativePath).not.toHaveBeenCalled()

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
