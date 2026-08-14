// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import React, { createRef } from 'react'
import { FileExplorerApp, type FileExplorerAppHandle } from '../src/client/app.tsx'
import { registerPreview } from '../src/client/preview/registry.ts'
import type { PreviewProps } from '../src/client/preview/registry.ts'
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

/** Stub preview component rendering a stable marker plus the text content. */
const TxtPreview = ({ preview }: PreviewProps) => {
  if (preview.kind === 'text') {
    return <div data-fe-preview="text">{preview.content}</div>
  }
  return <div data-fe-preview="other">{preview.name}</div>
}

// Register the stub so `resolvePreview('txt')` resolves to it for this suite.
registerPreview('txt', TxtPreview)

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

function makeProps() {
  return {
    sessionId: 's1' as string | undefined,
    fetchList: vi.fn().mockResolvedValue(rootEntries),
    fetchPreview: vi.fn().mockResolvedValue(cannedPreview),
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
    expect(panel!.textContent).toContain('从文件树选择文件')
  })
})
