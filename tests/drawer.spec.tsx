// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import React from 'react'
import { FileExplorerDrawer, FloatingFileButton } from '../src/client/drawer.tsx'

/** Identity translator: renders the localization key as-is. */
const t = (key: string) => key

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
      <FileExplorerDrawer open={false} onClose={() => {}} t={t}>
        <span>Tree</span>
      </FileExplorerDrawer>,
    )
    expect(container.querySelector('[data-fe-drawer]')).toBeNull()
  })

  test('renders a drawer root when open', () => {
    const container = render(
      <FileExplorerDrawer open onClose={() => {}} t={t}>
        <span>Tree</span>
      </FileExplorerDrawer>,
    )
    const drawer = container.querySelector('[data-fe-drawer]')
    expect(drawer).not.toBeNull()
    expect(drawer!.className).toContain('dsh-fe-drawer')
  })

  test('renders the localized default title', () => {
    const container = render(
      <FileExplorerDrawer open onClose={() => {}} t={t}>
        <span>Tree</span>
      </FileExplorerDrawer>,
    )
    const titleText = container.querySelector('.dsh-fe-drawer-title-text')
    expect(titleText).not.toBeNull()
    expect(titleText!.textContent).toBe('title')
  })

  test('renders a custom title', () => {
    const container = render(
      <FileExplorerDrawer open onClose={() => {}} t={t} title="My Files">
        <span>Tree</span>
      </FileExplorerDrawer>,
    )
    const titleText = container.querySelector('.dsh-fe-drawer-title-text')
    expect(titleText).not.toBeNull()
    expect(titleText!.textContent).toBe('My Files')
  })

  test('renders children inside the scrollable body', () => {
    const container = render(
      <FileExplorerDrawer open onClose={() => {}} t={t}>
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
      <FileExplorerDrawer open onClose={onClose} t={t}>
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

  test('renders a refresh button to the left of close when onRefresh is provided', () => {
    const container = render(
      <FileExplorerDrawer open onClose={() => {}} onRefresh={() => {}} t={t}>
        <span>Tree</span>
      </FileExplorerDrawer>,
    )
    const titleBar = container.querySelector('.dsh-fe-drawer-title')
    expect(titleBar).not.toBeNull()

    const buttons = Array.from(titleBar!.querySelectorAll('button'))
    expect(buttons).toHaveLength(2)

    const refreshBtn = buttons[0]
    expect(refreshBtn.getAttribute('data-fe-action')).toBe('refresh')
    expect(refreshBtn.getAttribute('title')).toBe('refresh')
    expect(refreshBtn.className).toContain('dsh-fe-btn')

    const closeBtn = buttons[1]
    expect(closeBtn.hasAttribute('data-fe-drawer-close')).toBe(true)
  })

  test('clicking the refresh button calls onRefresh', () => {
    const onRefresh = vi.fn()
    const container = render(
      <FileExplorerDrawer open onClose={() => {}} onRefresh={onRefresh} t={t}>
        <span>Tree</span>
      </FileExplorerDrawer>,
    )
    const refreshBtn = container.querySelector('[data-fe-action="refresh"]')
    expect(refreshBtn).not.toBeNull()

    act(() => {
      ;(refreshBtn as HTMLElement).click()
    })

    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  test('does not render a refresh button when onRefresh is omitted', () => {
    const container = render(
      <FileExplorerDrawer open onClose={() => {}} t={t}>
        <span>Tree</span>
      </FileExplorerDrawer>,
    )
    expect(container.querySelector('[data-fe-action="refresh"]')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// FloatingFileButton
// ---------------------------------------------------------------------------
describe('FloatingFileButton', () => {
  test('renders a button with the localized label', () => {
    const container = render(<FloatingFileButton onClick={() => {}} t={t} />)
    const button = container.querySelector('[data-fe-file-button]')
    expect(button).not.toBeNull()
    expect(button!.className).toContain('dsh-fe-file-button')
    expect(button!.textContent).toContain('file')
  })

  test('clicking the button calls onClick', () => {
    const onClick = vi.fn()
    const container = render(<FloatingFileButton onClick={onClick} t={t} />)
    const button = container.querySelector('[data-fe-file-button]')

    act(() => {
      ;(button as HTMLElement).click()
    })

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  test('hover-move without pointerdown does not move the button', () => {
    const container = render(<FloatingFileButton onClick={() => {}} t={t} />)
    const button = container.querySelector('[data-fe-file-button]') as HTMLElement
    const initialTop = button.style.top

    act(() => {
      button.dispatchEvent(new PointerEvent('pointermove', { clientY: 300, bubbles: true }))
    })

    expect(button.style.top).toBe(initialTop)
  })

  test('dragging the button vertically moves it and suppresses click', () => {
    const onClick = vi.fn()
    const container = render(<FloatingFileButton onClick={onClick} t={t} />)
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
