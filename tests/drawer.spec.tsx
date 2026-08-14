// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import React from 'react'
import { FileExplorerDrawer, FloatingFileButton } from '../src/client/drawer.tsx'

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
if (!('setPointerCapture' in Element.prototype)) {
  ;(Element.prototype as any).setPointerCapture = function () {}
  ;(Element.prototype as any).releasePointerCapture = function () {}
}

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

// ---------------------------------------------------------------------------
// FileExplorerDrawer
// ---------------------------------------------------------------------------
describe('FileExplorerDrawer', () => {
  test('renders null when open is false', () => {
    const container = render(
      <FileExplorerDrawer open={false} onClose={() => {}}>
        <span>Tree</span>
      </FileExplorerDrawer>,
    )
    expect(container.querySelector('[data-fe-drawer]')).toBeNull()
  })

  test('renders a drawer root when open', () => {
    const container = render(
      <FileExplorerDrawer open onClose={() => {}}>
        <span>Tree</span>
      </FileExplorerDrawer>,
    )
    const drawer = container.querySelector('[data-fe-drawer]')
    expect(drawer).not.toBeNull()
    expect(drawer!.className).toContain('dsh-fe-drawer')
  })

  test('renders the default title 文件浏览器', () => {
    const container = render(
      <FileExplorerDrawer open onClose={() => {}}>
        <span>Tree</span>
      </FileExplorerDrawer>,
    )
    const titleText = container.querySelector('.dsh-fe-drawer-title-text')
    expect(titleText).not.toBeNull()
    expect(titleText!.textContent).toBe('文件浏览器')
  })

  test('renders a custom title', () => {
    const container = render(
      <FileExplorerDrawer open onClose={() => {}} title="My Files">
        <span>Tree</span>
      </FileExplorerDrawer>,
    )
    const titleText = container.querySelector('.dsh-fe-drawer-title-text')
    expect(titleText).not.toBeNull()
    expect(titleText!.textContent).toBe('My Files')
  })

  test('renders children inside the scrollable body', () => {
    const container = render(
      <FileExplorerDrawer open onClose={() => {}}>
        <span data-testid="tree">File Tree</span>
      </FileExplorerDrawer>,
    )
    const body = container.querySelector('.dsh-fe-drawer-body')
    expect(body).not.toBeNull()
    expect(body!.textContent).toContain('File Tree')
  })

  test('clicking the close button calls onClose', () => {
    const onClose = vi.fn()
    const container = render(
      <FileExplorerDrawer open onClose={onClose}>
        <span>Tree</span>
      </FileExplorerDrawer>,
    )
    const closeBtn = container.querySelector('[data-fe-drawer-close]')
    expect(closeBtn).not.toBeNull()

    act(() => {
      ;(closeBtn as HTMLElement).click()
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// FloatingFileButton
// ---------------------------------------------------------------------------
describe('FloatingFileButton', () => {
  test('renders a button labeled 文件', () => {
    const container = render(<FloatingFileButton onClick={() => {}} />)
    const button = container.querySelector('[data-fe-file-button]')
    expect(button).not.toBeNull()
    expect(button!.className).toContain('dsh-fe-file-button')
    expect(button!.textContent).toContain('文件')
  })

  test('clicking the button calls onClick', () => {
    const onClick = vi.fn()
    const container = render(<FloatingFileButton onClick={onClick} />)
    const button = container.querySelector('[data-fe-file-button]')

    act(() => {
      ;(button as HTMLElement).click()
    })

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  test('dragging the button vertically moves it and suppresses click', () => {
    const onClick = vi.fn()
    const container = render(<FloatingFileButton onClick={onClick} />)
    const button = container.querySelector('[data-fe-file-button]') as HTMLElement

    act(() => {
      button.dispatchEvent(new PointerEvent('pointerdown', { clientY: 100, bubbles: true }))
      button.dispatchEvent(new PointerEvent('pointermove', { clientY: 160, bubbles: true }))
      button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    })

    // Dragging moved the button down (top > initial)...
    expect(parseInt(button.style.top, 10)).toBeGreaterThan(0)
    // ...and did NOT trigger a click.
    expect(onClick).not.toHaveBeenCalled()
  })
})
