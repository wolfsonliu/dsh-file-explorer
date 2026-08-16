// @vitest-environment jsdom
import { describe, expect, test, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import React, { createRef } from 'react'
import { FileExplorerApp, type FileExplorerAppHandle, type FileExplorerAppProps } from '../src/client/app.tsx'
import { registerPreview } from '../src/client/preview/registry.ts'
import type { PreviewProps } from '../src/client/preview/registry.ts'
import { MarkdownPreview } from '../src/client/preview/markdown.tsx'
import { registerBuiltinFileActions } from '../src/client/file-action.ts'
import type { BrowserEntry, FilePreview } from '../src/protocol.ts'

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

const rootEntries: BrowserEntry[] = [
  { name: 'notes.txt', path: 'notes.txt', kind: 'file', size: 11 },
]

const cannedPreview: FilePreview = {
  kind: 'text',
  name: 'notes.txt',
  extension: 'txt',
  content: 'hello world',
  size: 11,
}

const cannedMdPreview: FilePreview = {
  kind: 'text',
  name: 'readme.md',
  extension: 'md',
  content: '# Hi',
  size: 4,
}

const otherPreview: FilePreview = {
  kind: 'text',
  name: 'other.txt',
  extension: 'txt',
  content: 'other',
  size: 5,
}

/** Stub preview component rendering a stable marker plus the text content. */
const TxtPreview = ({ preview }: PreviewProps) => {
  if (preview.kind === 'text') {
    return <div data-fe-preview="text">{preview.content}</div>
  }
  return <div data-fe-preview="other">{preview.name}</div>
}

// Register the stub so `resolvePreview('txt')` resolves to it for this suite.
registerPreview('txt', TxtPreview)

registerPreview('md', MarkdownPreview)

// Register built-in file actions once for this whole spec file (the registry
// is module-level and not idempotent).
beforeAll(() => {
  registerBuiltinFileActions()
})

// Stub navigator.clipboard — jsdom does not implement it.
beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
    configurable: true,
    writable: true,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Render a React element into a jsdom container and return the container. */
function render(element: React.ReactElement): HTMLElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(element)
  })
  return container
}

/** Flush all pending microtasks so async state updates settle. */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, 0))
  })
}

/** Set a controlled <textarea>'s value and fire React's onChange. */
function setTextarea(container: HTMLElement, value: string): void {
  const ta = container.querySelector('textarea') as HTMLTextAreaElement
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!
  act(() => {
    setter.call(ta, value)
    ta.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function makeProps(overrides: Partial<FileExplorerAppProps> = {}) {
  return {
    sessionId: 's1' as string | undefined,
    fetchList: vi.fn().mockResolvedValue(rootEntries),
    fetchPreview: vi.fn().mockResolvedValue(cannedPreview),
    t: (key: string) => key,
    writeFile: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// FileExplorerApp
// ---------------------------------------------------------------------------
describe('FileExplorerApp', () => {
  test('drawer is closed by default but floating button is present', () => {
    const props = makeProps()
    const container = render(<FileExplorerApp {...props} />)

    expect(container.querySelector('[data-fe-drawer]')).toBeNull()
    expect(container.querySelector('[data-fe-file-button]')).not.toBeNull()
  })

  test('toggleDrawer opens the drawer; closeDrawer/toggleDrawer closes it', () => {
    const ref = createRef<FileExplorerAppHandle>()
    const props = makeProps()
    const container = render(<FileExplorerApp ref={ref} {...props} />)

    act(() => ref.current!.toggleDrawer())
    expect(container.querySelector('[data-fe-drawer]')).not.toBeNull()

    act(() => ref.current!.closeDrawer())
    expect(container.querySelector('[data-fe-drawer]')).toBeNull()

    act(() => ref.current!.toggleDrawer())
    expect(container.querySelector('[data-fe-drawer]')).not.toBeNull()

    act(() => ref.current!.toggleDrawer())
    expect(container.querySelector('[data-fe-drawer]')).toBeNull()
  })

  test('floating button click toggles the drawer', () => {
    const props = makeProps()
    const container = render(<FileExplorerApp {...props} />)

    const button = container.querySelector('[data-fe-file-button]') as HTMLElement
    expect(button).not.toBeNull()

    act(() => button.click())
    expect(container.querySelector('[data-fe-drawer]')).not.toBeNull()

    act(() => button.click())
    expect(container.querySelector('[data-fe-drawer]')).toBeNull()
  })

  test('clicking a file in the tree fetches preview and opens the panel', async () => {
    const props = makeProps()
    const ref = createRef<FileExplorerAppHandle>()
    const container = render(<FileExplorerApp ref={ref} {...props} />)

    // Open the drawer so the tree is mounted.
    act(() => ref.current!.toggleDrawer())
    await flush()

    const row = Array.from(container.querySelectorAll('.dsh-fe-tree-row')).find(
      (r) => r.textContent!.includes('notes.txt'),
    ) as HTMLElement
    expect(row).toBeTruthy()

    act(() => row.click())
    await flush()

    expect(props.fetchPreview).toHaveBeenCalledWith('s1', 'notes.txt')

    const panel = container.querySelector('[data-visible]')
    expect(panel).not.toBeNull()
    expect(panel!.getAttribute('data-visible')).toBe('true')
    expect(container.textContent).toContain('hello world')
  })

  test('openFile via ref opens the drawer, fetches preview, and opens the panel', async () => {
    const props = makeProps()
    const ref = createRef<FileExplorerAppHandle>()
    const container = render(<FileExplorerApp ref={ref} {...props} />)

    act(() => ref.current!.openFile('notes.txt'))
    await flush()

    expect(props.fetchPreview).toHaveBeenCalledWith('s1', 'notes.txt')
    expect(container.querySelector('[data-fe-drawer]')).not.toBeNull()

    const panel = container.querySelector('[data-visible]')
    expect(panel).not.toBeNull()
    expect(panel!.getAttribute('data-visible')).toBe('true')
    expect(container.textContent).toContain('hello world')
  })

  test('preview panel title shows the opened file name', async () => {
    const props = makeProps()
    const ref = createRef<FileExplorerAppHandle>()
    const container = render(<FileExplorerApp ref={ref} {...props} />)

    act(() => ref.current!.openFile('notes.txt'))
    await flush()

    const panel = container.querySelector('[data-visible]') as HTMLElement
    expect(panel).not.toBeNull()
    const title = panel.querySelector('.dsh-fe-title-text') as HTMLElement
    expect(title).not.toBeNull()
    expect(title.textContent).toBe('notes.txt')
  })

  test('preview panel close button hides the panel', async () => {
    const props = makeProps()
    const ref = createRef<FileExplorerAppHandle>()
    const container = render(<FileExplorerApp ref={ref} {...props} />)

    act(() => ref.current!.openFile('notes.txt'))
    await flush()

    const panel = container.querySelector('[data-visible]')
    expect(panel).not.toBeNull()

    const closeBtn = panel!.querySelector('[data-fe-action="close"]') as HTMLElement
    expect(closeBtn).not.toBeNull()

    act(() => closeBtn.click())

    expect(container.querySelector('[data-visible]')).toBeNull()
  })

  test('renders placeholder when preview resolves to null', async () => {
    const props = makeProps()
    props.fetchPreview = vi.fn().mockResolvedValue(null)

    const ref = createRef<FileExplorerAppHandle>()
    const container = render(<FileExplorerApp ref={ref} {...props} />)

    act(() => ref.current!.openFile('notes.txt'))
    await flush()

    const panel = container.querySelector('[data-visible]')
    expect(panel).not.toBeNull()
    expect(panel!.textContent).toContain('selectFile')
  })

  test('clicking the ellipsis menu "open" item opens the preview via helpers', async () => {
    const props = makeProps()
    const ref = createRef<FileExplorerAppHandle>()
    const container = render(<FileExplorerApp ref={ref} {...props} />)

    act(() => ref.current!.toggleDrawer())
    await flush()

    const row = Array.from(container.querySelectorAll('.dsh-fe-tree-row')).find(
      (r) => r.textContent!.includes('notes.txt'),
    ) as HTMLElement
    expect(row).toBeTruthy()

    const btn = row.querySelector('[data-fe-action-button]') as HTMLElement
    expect(btn).toBeTruthy()
    act(() => btn.click())

    const menu = container.querySelector('[role="menu"]') as HTMLElement
    expect(menu).not.toBeNull()
    const openItem = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(
      (el) => el.textContent!.includes('open'),
    ) as HTMLElement
    expect(openItem).toBeTruthy()

    act(() => openItem.click())
    await flush()

    expect(props.fetchPreview).toHaveBeenCalledWith('s1', 'notes.txt')

    const panel = container.querySelector('[data-visible]')
    expect(panel).not.toBeNull()
    expect(panel!.getAttribute('data-visible')).toBe('true')
    expect(container.textContent).toContain('hello world')
  })

  test('"open-as-text" fetches text mode and renders built-in TextPreview', async () => {
    const props = makeProps()
    const ref = createRef<FileExplorerAppHandle>()
    const container = render(<FileExplorerApp ref={ref} {...props} />)

    act(() => ref.current!.toggleDrawer())
    await flush()

    const row = Array.from(container.querySelectorAll('.dsh-fe-tree-row')).find(
      (r) => r.textContent!.includes('notes.txt'),
    ) as HTMLElement
    const btn = row.querySelector('[data-fe-action-button]') as HTMLElement
    act(() => btn.click())

    const menu = container.querySelector('[role="menu"]') as HTMLElement
    const item = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(
      (el) => el.textContent!.includes('openAsText'),
    ) as HTMLElement
    expect(item).toBeTruthy()

    act(() => item.click())
    await flush()

    expect(props.fetchPreview).toHaveBeenCalledWith('s1', 'notes.txt', 'text')
    const panel = container.querySelector('[data-visible]') as HTMLElement
    expect(panel).not.toBeNull()
    // Built-in TextPreview renders a <pre>; the registered TxtPreview would render data-fe-preview="text".
    expect(panel.querySelector('pre')).not.toBeNull()
    expect(panel.querySelector('[data-fe-preview="text"]')).toBeNull()
  })

  test('"open-as-binary" fetches binary mode and renders binary status', async () => {
    const props = makeProps()
    props.fetchPreview = vi.fn().mockImplementation((_sid: string, _path: string, mode?: string) =>
      Promise.resolve(
        mode === 'binary'
          ? { kind: 'binary', name: 'notes.txt', size: 11 } as FilePreview
          : cannedPreview,
      ),
    )
    const ref = createRef<FileExplorerAppHandle>()
    const container = render(<FileExplorerApp ref={ref} {...props} />)

    act(() => ref.current!.toggleDrawer())
    await flush()

    const row = Array.from(container.querySelectorAll('.dsh-fe-tree-row')).find(
      (r) => r.textContent!.includes('notes.txt'),
    ) as HTMLElement
    const btn = row.querySelector('[data-fe-action-button]') as HTMLElement
    act(() => btn.click())

    const menu = container.querySelector('[role="menu"]') as HTMLElement
    const item = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(
      (el) => el.textContent!.includes('openAsBinary'),
    ) as HTMLElement
    expect(item).toBeTruthy()

    act(() => item.click())
    await flush()

    expect(props.fetchPreview).toHaveBeenCalledWith('s1', 'notes.txt', 'binary')
    const panel = container.querySelector('[data-visible]') as HTMLElement
    expect(panel).not.toBeNull()
    // BinaryPreview renders StatusPreview → t('binary') == 'binary' with the identity translator.
    expect(panel.textContent).toContain('binary')
  })

  test('copy absolute path fetches resolve-path and writes the resolved path to clipboard', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ path: '/workspace/notes.txt' }),
      }),
    )

    const props = makeProps()
    const ref = createRef<FileExplorerAppHandle>()
    const container = render(<FileExplorerApp ref={ref} {...props} />)

    act(() => ref.current!.toggleDrawer())
    await flush()

    const row = Array.from(container.querySelectorAll('.dsh-fe-tree-row')).find(
      (r) => r.textContent!.includes('notes.txt'),
    ) as HTMLElement
    const btn = row.querySelector('[data-fe-action-button]') as HTMLElement
    act(() => btn.click())

    const menu = container.querySelector('[role="menu"]') as HTMLElement
    const copyAbsItem = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(
      (el) => el.textContent!.includes('copyAbsolutePath'),
    ) as HTMLElement
    expect(copyAbsItem).toBeTruthy()

    act(() => copyAbsItem.click())
    await flush()

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    const resolveCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes('action=resolve-path'),
    )
    expect(resolveCall).toBeDefined()
    expect(String(resolveCall![0])).toContain('sessionId=s1')
    expect(String(resolveCall![0])).toContain('path=notes.txt')

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('/workspace/notes.txt')
  })

  test('copy relative path writes the entry path to clipboard', async () => {
    const props = makeProps()
    const ref = createRef<FileExplorerAppHandle>()
    const container = render(<FileExplorerApp ref={ref} {...props} />)

    act(() => ref.current!.toggleDrawer())
    await flush()

    const row = Array.from(container.querySelectorAll('.dsh-fe-tree-row')).find(
      (r) => r.textContent!.includes('notes.txt'),
    ) as HTMLElement
    const btn = row.querySelector('[data-fe-action-button]') as HTMLElement
    act(() => btn.click())

    const menu = container.querySelector('[role="menu"]') as HTMLElement
    const copyRelItem = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(
      (el) => el.textContent!.includes('copyRelativePath'),
    ) as HTMLElement
    expect(copyRelItem).toBeTruthy()

    act(() => copyRelItem.click())
    await flush()

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('notes.txt')
  })

  test('markdown preview shows an edit button; entering edit prefills a textarea and cancel returns to preview', async () => {
    const props = makeProps({ fetchPreview: vi.fn().mockResolvedValue(cannedMdPreview) })
    const ref = createRef<FileExplorerAppHandle>()
    const container = render(<FileExplorerApp ref={ref} {...props} />)

    act(() => ref.current!.openFile('readme.md'))
    await flush()

    const editBtn = container.querySelector('[data-fe-edit="edit"]') as HTMLElement
    expect(editBtn).not.toBeNull()

    act(() => editBtn.click())
    const textarea = container.querySelector('[data-fe-edit="textarea"]') as HTMLTextAreaElement
    expect(textarea).not.toBeNull()
    expect(textarea.value).toBe('# Hi')

    const cancelBtn = container.querySelector('[data-fe-edit="cancel"]') as HTMLElement
    act(() => cancelBtn.click())
    expect(container.querySelector('[data-fe-edit="textarea"]')).toBeNull()
    expect(container.querySelector('h1')!.textContent).toBe('Hi')
    expect(props.writeFile).not.toHaveBeenCalled()
  })

  test('non-markdown text preview has no edit button', async () => {
    const props = makeProps()
    const ref = createRef<FileExplorerAppHandle>()
    const container = render(<FileExplorerApp ref={ref} {...props} />)

    act(() => ref.current!.openFile('notes.txt'))
    await flush()

    expect(container.querySelector('[data-fe-edit="edit"]')).toBeNull()
  })

  test('markdown preview has no edit button when writeFile is absent', async () => {
    const props = makeProps({ fetchPreview: vi.fn().mockResolvedValue(cannedMdPreview), writeFile: undefined })
    const ref = createRef<FileExplorerAppHandle>()
    const container = render(<FileExplorerApp ref={ref} {...props} />)

    act(() => ref.current!.openFile('readme.md'))
    await flush()

    expect(container.querySelector('[data-fe-edit="edit"]')).toBeNull()
  })

  test('save button writes the draft and stays in edit mode', async () => {
    const props = makeProps({ fetchPreview: vi.fn().mockResolvedValue(cannedMdPreview) })
    const ref = createRef<FileExplorerAppHandle>()
    const container = render(<FileExplorerApp ref={ref} {...props} />)

    act(() => ref.current!.openFile('readme.md'))
    await flush()

    act(() => (container.querySelector('[data-fe-edit="edit"]') as HTMLElement).click())
    setTextarea(container, '# Edited')

    const saveBtn = container.querySelector('[data-fe-edit="save"]') as HTMLElement
    expect(saveBtn).not.toBeNull()
    act(() => saveBtn.click())
    await flush()

    expect(props.writeFile).toHaveBeenCalledWith('readme.md', '# Edited')
    // 仍处于编辑态（textarea 还在），且内容保留。
    const textarea = container.querySelector('[data-fe-edit="textarea"]') as HTMLTextAreaElement
    expect(textarea).not.toBeNull()
    expect(textarea.value).toBe('# Edited')
  })

  test('a save completing after switching files does not overwrite the new preview', async () => {
    let resolveWrite: (() => void) | undefined
    const writeFile = vi.fn().mockImplementation(() => new Promise<void>((resolve) => { resolveWrite = resolve }))
    const props = makeProps({
      writeFile,
      fetchPreview: vi.fn().mockImplementation((_sid: string, path: string) =>
        Promise.resolve(path === 'readme.md' ? cannedMdPreview : otherPreview),
      ),
    })
    const ref = createRef<FileExplorerAppHandle>()
    const container = render(<FileExplorerApp ref={ref} {...props} />)

    act(() => ref.current!.openFile('readme.md'))
    await flush()

    act(() => (container.querySelector('[data-fe-edit="edit"]') as HTMLElement).click())
    setTextarea(container, '# Edited')
    act(() => (container.querySelector('[data-fe-edit="save"]') as HTMLElement).click())

    // While the save is pending, switch to another file.
    act(() => ref.current!.openFile('other.txt'))
    await flush()

    // Now complete the pending save.
    await act(async () => { resolveWrite!() })
    await flush()

    // The other file's preview must NOT be overwritten with the old draft.
    expect(container.textContent).toContain('other')
    expect(container.textContent).not.toContain('# Edited')
  })

  test('preview button saves the draft and switches back to rendered markdown', async () => {
    const props = makeProps({ fetchPreview: vi.fn().mockResolvedValue(cannedMdPreview) })
    const ref = createRef<FileExplorerAppHandle>()
    const container = render(<FileExplorerApp ref={ref} {...props} />)

    act(() => ref.current!.openFile('readme.md'))
    await flush()

    act(() => (container.querySelector('[data-fe-edit="edit"]') as HTMLElement).click())
    setTextarea(container, '# Edited')

    const previewBtn = container.querySelector('[data-fe-edit="preview"]') as HTMLElement
    expect(previewBtn).not.toBeNull()
    act(() => previewBtn.click())
    await flush()

    expect(props.writeFile).toHaveBeenCalledWith('readme.md', '# Edited')
    // 切回渲染视图：textarea 消失，渲染出 <h1>Edited</h1>。
    expect(container.querySelector('[data-fe-edit="textarea"]')).toBeNull()
    expect(container.querySelector('h1')!.textContent).toBe('Edited')
  })

  test('save failure shows an error and stays in edit mode', async () => {
    const props = makeProps({ fetchPreview: vi.fn().mockResolvedValue(cannedMdPreview) })
    props.writeFile = vi.fn().mockRejectedValue(new Error('disk full'))
    const ref = createRef<FileExplorerAppHandle>()
    const container = render(<FileExplorerApp ref={ref} {...props} />)

    act(() => ref.current!.openFile('readme.md'))
    await flush()

    act(() => (container.querySelector('[data-fe-edit="edit"]') as HTMLElement).click())
    setTextarea(container, '# Edited')

    act(() => (container.querySelector('[data-fe-edit="save"]') as HTMLElement).click())
    await flush()

    // 仍在编辑态，且显示错误文案。
    expect(container.querySelector('[data-fe-edit="textarea"]')).not.toBeNull()
    expect(container.textContent).toContain('saveFailed')
    expect(container.textContent).toContain('disk full')
  })

  test('switching files auto-saves a dirty markdown draft first', async () => {
    const props = makeProps({
      fetchPreview: vi.fn().mockImplementation((_sid: string, path: string) =>
        Promise.resolve(path === 'readme.md' ? cannedMdPreview : otherPreview),
      ),
    })
    const ref = createRef<FileExplorerAppHandle>()
    const container = render(<FileExplorerApp ref={ref} {...props} />)

    act(() => ref.current!.openFile('readme.md'))
    await flush()

    act(() => (container.querySelector('[data-fe-edit="edit"]') as HTMLElement).click())
    setTextarea(container, '# Edited')

    await act(async () => {
      await ref.current!.openFile('other.txt')
    })
    await flush()

    expect(props.writeFile).toHaveBeenCalledWith('readme.md', '# Edited')
    expect(props.fetchPreview).toHaveBeenCalledWith('s1', 'other.txt')
  })

  test('switching files aborts when the dirty draft fails to save', async () => {
    const props = makeProps({
      fetchPreview: vi.fn().mockImplementation((_sid: string, path: string) =>
        Promise.resolve(path === 'readme.md' ? cannedMdPreview : otherPreview),
      ),
    })
    props.writeFile = vi.fn().mockRejectedValue(new Error('disk full'))
    const ref = createRef<FileExplorerAppHandle>()
    const container = render(<FileExplorerApp ref={ref} {...props} />)

    act(() => ref.current!.openFile('readme.md'))
    await flush()

    act(() => (container.querySelector('[data-fe-edit="edit"]') as HTMLElement).click())
    setTextarea(container, '# Edited')

    await act(async () => {
      await ref.current!.openFile('other.txt')
    })
    await flush()

    // 写回失败 → 中止切换：不拉取目标文件的 preview。
    expect(props.fetchPreview).not.toHaveBeenCalledWith('s1', 'other.txt')
    // 仍在编辑态，错误可见。
    expect(container.querySelector('[data-fe-edit="textarea"]')).not.toBeNull()
    expect(container.textContent).toContain('disk full')
  })
})
