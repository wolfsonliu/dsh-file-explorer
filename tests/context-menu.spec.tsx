// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest'
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
// FileContextMenu
// ---------------------------------------------------------------------------
describe('FileContextMenu', () => {
  test('renders null when open is false', () => {
    const container = render(
      <FileContextMenu
        open={false}
        anchor={{ x: 100, y: 200 }}
        items={[{ id: 'open', label: 'Open', onSelect: vi.fn() }]}
        onClose={vi.fn()}
      />,
    )

    expect(container.querySelector('[role="menu"]')).toBeNull()
  })

  test('renders items with labels and custom icons when open', () => {
    const container = render(
      <FileContextMenu
        open={true}
        anchor={{ x: 100, y: 200 }}
        items={[
          { id: 'open', label: 'Open', icon: <span data-test-icon="open" />, onSelect: vi.fn() },
          { id: 'copy', label: 'Copy', onSelect: vi.fn() },
        ]}
        onClose={vi.fn()}
      />,
    )

    const menu = container.querySelector('[role="menu"]')
    expect(menu).not.toBeNull()

    const items = menu!.querySelectorAll('[role="menuitem"]')
    expect(items.length).toBe(2)
    expect(items[0].textContent).toContain('Open')
    expect(items[0].querySelector('[data-test-icon="open"]')).not.toBeNull()
    expect(items[1].textContent).toContain('Copy')
  })

  test('menu is positioned at the anchor when open', () => {
    const container = render(
      <FileContextMenu
        open={true}
        anchor={{ x: 100, y: 200 }}
        items={[{ id: 'open', label: 'Open', onSelect: vi.fn() }]}
        onClose={vi.fn()}
      />,
    )

    const menu = container.querySelector('[role="menu"]') as HTMLElement
    expect(menu).not.toBeNull()
    expect(menu.style.position).toBe('fixed')
    expect(menu.style.left).toBe('100px')
    expect(menu.style.top).toBe('200px')
  })

  test('clicking an item calls onSelect and then onClose', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()

    const container = render(
      <FileContextMenu
        open={true}
        anchor={{ x: 0, y: 0 }}
        items={[{ id: 'open', label: 'Open', onSelect }]}
        onClose={onClose}
      />,
    )

    const item = container.querySelector('[role="menuitem"]') as HTMLElement
    act(() => {
      item.click()
    })

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    // onSelect runs before onClose.
    expect(onSelect.mock.invocationCallOrder[0]).toBeLessThan(
      onClose.mock.invocationCallOrder[0],
    )
  })

  test('clicking outside the menu (document pointerdown) calls onClose', () => {
    const onClose = vi.fn()

    render(
      <FileContextMenu
        open={true}
        anchor={{ x: 100, y: 200 }}
        items={[{ id: 'open', label: 'Open', onSelect: vi.fn() }]}
        onClose={onClose}
      />,
    )

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
        open={true}
        anchor={{ x: 100, y: 200 }}
        items={[{ id: 'open', label: 'Open', onSelect: vi.fn() }]}
        onClose={onClose}
      />,
    )

    const menu = container.querySelector('[role="menu"]') as HTMLElement
    act(() => {
      menu.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true }),
      )
    })

    expect(onClose).not.toHaveBeenCalled()
  })
})
