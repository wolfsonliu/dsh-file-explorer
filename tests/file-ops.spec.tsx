// @vitest-environment jsdom
import { beforeAll, describe, expect, test, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import React from 'react'
import { FileOpsModal } from '../src/client/file-ops-modal.tsx'
import { basenameOfRel, joinRel, type FileOp, type FileOps } from '../src/client/file-ops.ts'
import { FileExplorerApp } from '../src/client/app.tsx'
import { registerBuiltinFileActions } from '../src/client/file-action.ts'
import type { BrowserEntry, FilePreview } from '../src/protocol.ts'

const t = (key: string) => key

function render(element: React.ReactElement): HTMLElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => { root.render(element) })
  return container
}

async function flush(): Promise<void> {
  await act(async () => { await new Promise<void>((r) => setTimeout(r, 0)) })
}

function setInput(container: HTMLElement, value: string): void {
  const input = container.querySelector('[data-fe-op-input]') as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function makeFileOps(overrides: Partial<FileOps> = {}): FileOps {
  return {
    createFile: vi.fn().mockResolvedValue(undefined),
    createDir: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    move: vi.fn().mockResolvedValue(undefined),
    copy: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

const dirEntries: BrowserEntry[] = [
  { name: 'src', path: 'src', kind: 'directory' },
  { name: 'docs', path: 'docs', kind: 'directory' },
  { name: 'a.txt', path: 'a.txt', kind: 'file' },
]

const fileEntry: BrowserEntry = { name: 'notes.txt', path: 'notes.txt', kind: 'file' }

beforeAll(() => { registerBuiltinFileActions() })

const rootEntries: BrowserEntry[] = [ { name: 'notes.txt', path: 'notes.txt', kind: 'file', size: 11 } ]
const cannedPreview: FilePreview = { kind: 'text', name: 'notes.txt', extension: 'txt', content: 'hello world', size: 11 }
const renamedPreview: FilePreview = { kind: 'text', name: 'renamed.txt', extension: 'txt', content: 'hello world', size: 11 }

function makeAppProps(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 's1' as string | undefined,
    fetchList: vi.fn().mockResolvedValue(rootEntries),
    fetchPreview: vi.fn().mockImplementation((_sid: string, path: string) =>
      Promise.resolve(path === 'renamed.txt' ? renamedPreview : cannedPreview)),
    t: (key: string) => key,
    writeFile: vi.fn().mockResolvedValue(undefined),
    fileOps: makeFileOps(),
    ...overrides,
  }
}

function rowNamed(container: HTMLElement, name: string): HTMLElement {
  const row = Array.from(container.querySelectorAll('.dsh-fe-tree-row')).find((r) =>
    r.textContent!.includes(name),
  ) as HTMLElement
  expect(row).toBeTruthy()
  return row
}

function menuItemByText(container: HTMLElement, text: string): HTMLElement {
  const item = Array.from(container.querySelectorAll('[role="menuitem"]')).find((el) =>
    el.textContent!.includes(text),
  ) as HTMLElement
  expect(item).toBeTruthy()
  return item
}

describe('file-ops helpers', () => {
  test('joinRel joins under a parent or returns the bare name at root', () => {
    expect(joinRel('', 'a.txt')).toBe('a.txt')
    expect(joinRel('subdir', 'a.txt')).toBe('subdir/a.txt')
  })

  test('basenameOfRel returns the final segment', () => {
    expect(basenameOfRel('subdir/a.txt')).toBe('a.txt')
    expect(basenameOfRel('a.txt')).toBe('a.txt')
  })
})

describe('FileOpsModal', () => {
  test('rename form prefills the name and submits the trimmed value', async () => {
    const fileOps = makeFileOps()
    const onDone = vi.fn()
    const op: FileOp = { kind: 'rename', entry: fileEntry }
    const container = render(
      <FileOpsModal op={op} fileOps={fileOps} fetchList={vi.fn()} sessionId="s1" t={t} onDone={onDone} onCancel={vi.fn()} />,
    )
    expect(container.querySelector('[data-fe-op="rename"]')).not.toBeNull()
    const input = container.querySelector('[data-fe-op-input]') as HTMLInputElement
    expect(input.value).toBe('notes.txt')
    setInput(container, '  renamed.txt  ')
    act(() => { (container.querySelector('[data-fe-op-submit]') as HTMLElement).click() })
    await flush()
    expect(fileOps.rename).toHaveBeenCalledWith('notes.txt', 'renamed.txt')
    expect(onDone).toHaveBeenCalledWith('renamed.txt')
  })

  test('new-file submits createFile with the joined path', async () => {
    const fileOps = makeFileOps()
    const onDone = vi.fn()
    const op: FileOp = { kind: 'new-file', parentDir: 'src' }
    const container = render(
      <FileOpsModal op={op} fileOps={fileOps} fetchList={vi.fn()} sessionId="s1" t={t} onDone={onDone} onCancel={vi.fn()} />,
    )
    setInput(container, 'thing.ts')
    act(() => { (container.querySelector('[data-fe-op-submit]') as HTMLElement).click() })
    await flush()
    expect(fileOps.createFile).toHaveBeenCalledWith('src/thing.ts')
    expect(onDone).toHaveBeenCalledWith('src/thing.ts')
  })

  test('submit is disabled when the input is empty', () => {
    const op: FileOp = { kind: 'new-folder', parentDir: '' }
    const container = render(
      <FileOpsModal op={op} fileOps={makeFileOps()} fetchList={vi.fn()} sessionId="s1" t={t} onDone={vi.fn()} onCancel={vi.fn()} />,
    )
    const submit = container.querySelector('[data-fe-op-submit]') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
  })

  test('delete confirm calls remove and onDone with the entry path', async () => {
    const fileOps = makeFileOps()
    const onDone = vi.fn()
    const op: FileOp = { kind: 'delete', entry: fileEntry }
    const container = render(
      <FileOpsModal op={op} fileOps={fileOps} fetchList={vi.fn()} sessionId="s1" t={t} onDone={onDone} onCancel={vi.fn()} />,
    )
    expect(container.querySelector('[data-fe-op="delete"]')).not.toBeNull()
    act(() => { (container.querySelector('[data-fe-op-submit]') as HTMLElement).click() })
    await flush()
    expect(fileOps.remove).toHaveBeenCalledWith('notes.txt')
    expect(onDone).toHaveBeenCalledWith('notes.txt')
  })

  test('move picker lists directories, defaults to root, and submits', async () => {
    const fileOps = makeFileOps()
    const onDone = vi.fn()
    const op: FileOp = { kind: 'move', entry: fileEntry }
    const fetchList = vi.fn().mockResolvedValue(dirEntries)
    const container = render(
      <FileOpsModal op={op} fileOps={fileOps} fetchList={fetchList} sessionId="s1" t={t} onDone={onDone} onCancel={vi.fn()} />,
    )
    await flush()
    const rows = container.querySelectorAll('[data-fe-op-dir-row]')
    expect(rows.length).toBe(3)
    const docsRow = Array.from(rows).find((r) => r.getAttribute('data-fe-path') === 'docs') as HTMLElement
    act(() => { docsRow.click() })
    act(() => { (container.querySelector('[data-fe-op-submit]') as HTMLElement).click() })
    await flush()
    expect(fileOps.move).toHaveBeenCalledWith('notes.txt', 'docs')
    expect(onDone).toHaveBeenCalledWith('docs/notes.txt')
  })

  test('a failing operation shows an error and does not call onDone', async () => {
    const fileOps = makeFileOps({ remove: vi.fn().mockRejectedValue(new Error('boom')) })
    const onDone = vi.fn()
    const op: FileOp = { kind: 'delete', entry: fileEntry }
    const container = render(
      <FileOpsModal op={op} fileOps={fileOps} fetchList={vi.fn()} sessionId="s1" t={t} onDone={onDone} onCancel={vi.fn()} />,
    )
    act(() => { (container.querySelector('[data-fe-op-submit]') as HTMLElement).click() })
    await flush()
    expect(onDone).not.toHaveBeenCalled()
    expect(container.textContent).toContain('boom')
  })
})

describe('FileExplorerApp file operations', () => {
  test('rename from the row menu renames, refreshes the tree, and updates the open file', async () => {
    const props = makeAppProps()
    const container = render(<FileExplorerApp {...props} />)
    const appRef = container.querySelector('[data-fe-file-button]') as HTMLElement
    act(() => { appRef.click() })
    await flush()

    act(() => { rowNamed(container, 'notes.txt').click() })
    await flush()
    expect(props.fetchPreview).toHaveBeenCalledWith('s1', 'notes.txt')

    act(() => { (rowNamed(container, 'notes.txt').querySelector('[data-fe-action-button]') as HTMLElement).click() })
    act(() => { menuItemByText(container, 'rename').click() })
    expect(container.querySelector('[data-fe-op="rename"]')).not.toBeNull()

    setInput(container, 'renamed.txt')
    const fetchCountBefore = props.fetchList.mock.calls.length
    act(() => { (container.querySelector('[data-fe-op-submit]') as HTMLElement).click() })
    await flush()

    expect(props.fileOps.rename).toHaveBeenCalledWith('notes.txt', 'renamed.txt')
    expect(props.fetchList.mock.calls.length).toBeGreaterThan(fetchCountBefore)
    expect(props.fetchPreview).toHaveBeenCalledWith('s1', 'renamed.txt')
    const panel = container.querySelector('[data-visible]') as HTMLElement
    expect(panel.querySelector('.dsh-fe-title-text')!.textContent).toBe('renamed.txt')
  })

  test('delete from the row menu clears the current preview', async () => {
    const props = makeAppProps()
    const container = render(<FileExplorerApp {...props} />)
    act(() => { (container.querySelector('[data-fe-file-button]') as HTMLElement).click() })
    await flush()

    act(() => { rowNamed(container, 'notes.txt').click() })
    await flush()
    expect(container.querySelector('[data-visible]')).not.toBeNull()

    act(() => { (rowNamed(container, 'notes.txt').querySelector('[data-fe-action-button]') as HTMLElement).click() })
    act(() => { menuItemByText(container, 'delete').click() })
    expect(container.querySelector('[data-fe-op="delete"]')).not.toBeNull()

    act(() => { (container.querySelector('[data-fe-op-submit]') as HTMLElement).click() })
    await flush()

    expect(props.fileOps.remove).toHaveBeenCalledWith('notes.txt')
    expect(container.querySelector('[data-visible]')).toBeNull()
  })

  test('the drawer "＋ 新建" button opens a two-item menu', async () => {
    const props = makeAppProps()
    const container = render(<FileExplorerApp {...props} />)
    act(() => { (container.querySelector('[data-fe-file-button]') as HTMLElement).click() })
    await flush()

    const newBtn = container.querySelector('[data-fe-new-button]') as HTMLElement
    expect(newBtn).not.toBeNull()
    act(() => { newBtn.click() })

    const items = container.querySelectorAll('[role="menuitem"]')
    expect(items.length).toBe(2)
    expect(items[0].textContent).toContain('newFile')
    expect(items[1].textContent).toContain('newFolder')
  })
})
