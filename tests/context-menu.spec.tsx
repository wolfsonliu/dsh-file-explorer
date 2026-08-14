// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import React from 'react'
import { FileContextMenu } from '../src/client/context-menu.tsx'

// ---------------------------------------------------------------------------
// jsdom polyfills
// ---------------------------------------------------------------------------

// jsdom does not expose PointerEvent; polyfill from MouseEvent.
if (typeof PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    declare pointerId: number
    declare pointerType: string
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = (init as any).pointerId ?? 1
      this.pointerType = (init as any).pointerType ?? 'mouse'
    }
  }
  ;(globalThis as any).PointerEvent = PointerEventPolyfill
}

// Stub navigator.clipboard — jsdom does not implement it
beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
    configurable: true,
    writable: true,
  })
})

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

// ---------------------------------------------------------------------------
// FileContextMenu
// ---------------------------------------------------------------------------
describe('FileContextMenu', () => {
  test('renders null when open is false', () => {
    const container = render(
      <FileContextMenu
        x={100}
        y={200}
        open={false}
        path="/home/user/file.ts"
        relativePath="file.ts"
        onOpen={vi.fn()}
        onCopyPath={vi.fn()}
        onCopyRelativePath={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    const menu = container.querySelector('[role="menu"]')
    expect(menu).toBeNull()
  })

  test('renders menu with three items when open', () => {
    const container = render(
      <FileContextMenu
        x={100}
        y={200}
        open={true}
        path="/home/user/file.ts"
        relativePath="file.ts"
        onOpen={vi.fn()}
        onCopyPath={vi.fn()}
        onCopyRelativePath={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    const menu = container.querySelector('[role="menu"]')
    expect(menu).not.toBeNull()

    const items = menu!.querySelectorAll('[role="menuitem"]')
    expect(items.length).toBe(3)
    expect(items[0].textContent).toBe('打开')
    expect(items[1].textContent).toBe('复制路径')
    expect(items[2].textContent).toBe('复制相对路径')
  })

  test('menu is positioned at (x, y) when open', () => {
    const container = render(
      <FileContextMenu
        x={100}
        y={200}
        open={true}
        path="/home/user/file.ts"
        relativePath="file.ts"
        onOpen={vi.fn()}
        onCopyPath={vi.fn()}
        onCopyRelativePath={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    const menu = container.querySelector('[role="menu"]') as HTMLElement
    expect(menu).not.toBeNull()
    expect(menu.style.position).toBe('fixed')
    expect(menu.style.left).toBe('100px')
    expect(menu.style.top).toBe('200px')
  })

  test('clicking 打开 calls onOpen and onClose', () => {
    const onOpen = vi.fn()
    const onClose = vi.fn()

    const container = render(
      <FileContextMenu
        x={100}
        y={200}
        open={true}
        path="/home/user/file.ts"
        relativePath="file.ts"
        onOpen={onOpen}
        onCopyPath={vi.fn()}
        onCopyRelativePath={vi.fn()}
        onClose={onClose}
      />,
    )

    const items = container.querySelectorAll('[role="menuitem"]')
    const openItem = items[0] as HTMLElement

    act(() => {
      openItem.click()
    })

    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('clicking 复制路径 calls navigator.clipboard.writeText with path and then onClose', async () => {
    const onCopyPath = vi.fn()
    const onClose = vi.fn()

    const container = render(
      <FileContextMenu
        x={100}
        y={200}
        open={true}
        path="/home/user/file.ts"
        relativePath="file.ts"
        onOpen={vi.fn()}
        onCopyPath={onCopyPath}
        onCopyRelativePath={vi.fn()}
        onClose={onClose}
      />,
    )

    const items = container.querySelectorAll('[role="menuitem"]')
    const copyPathItem = items[1] as HTMLElement

    act(() => {
      copyPathItem.click()
    })

    // Flush microtasks so the .then() callbacks fire
    await flush()

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('/home/user/file.ts')
    expect(onCopyPath).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('clicking 复制相对路径 calls navigator.clipboard.writeText with relativePath', async () => {
    const onCopyRelativePath = vi.fn()
    const onClose = vi.fn()

    const container = render(
      <FileContextMenu
        x={100}
        y={200}
        open={true}
        path="/home/user/file.ts"
        relativePath="file.ts"
        onOpen={vi.fn()}
        onCopyPath={vi.fn()}
        onCopyRelativePath={onCopyRelativePath}
        onClose={onClose}
      />,
    )

    const items = container.querySelectorAll('[role="menuitem"]')
    const copyRelItem = items[2] as HTMLElement

    act(() => {
      copyRelItem.click()
    })

    // Flush microtasks so the .then() callbacks fire
    await flush()

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('file.ts')
    expect(onCopyRelativePath).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('clicking outside the menu (document pointerdown) calls onClose', () => {
    const onClose = vi.fn()

    render(
      <FileContextMenu
        x={100}
        y={200}
        open={true}
        path="/home/user/file.ts"
        relativePath="file.ts"
        onOpen={vi.fn()}
        onCopyPath={vi.fn()}
        onCopyRelativePath={vi.fn()}
        onClose={onClose}
      />,
    )

    // Simulate a pointerdown on document (outside the menu)
    act(() => {
      document.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true }),
      )
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('pointerdown on the menu itself does NOT call onClose', () => {
    const onClose = vi.fn()

    const container = render(
      <FileContextMenu
        x={100}
        y={200}
        open={true}
        path="/home/user/file.ts"
        relativePath="file.ts"
        onOpen={vi.fn()}
        onCopyPath={vi.fn()}
        onCopyRelativePath={vi.fn()}
        onClose={onClose}
      />,
    )

    const menu = container.querySelector('[role="menu"]') as HTMLElement

    // Simulate a pointerdown directly on the menu
    act(() => {
      menu.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true }),
      )
    })

    expect(onClose).not.toHaveBeenCalled()
  })
})