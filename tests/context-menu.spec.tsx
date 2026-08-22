// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest'
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

const roots: Array<ReturnType<typeof createRoot>> = []

/** Render a React element into a jsdom container and return the container. */
function render(element: React.ReactElement): HTMLElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  act(() => {
    root.render(element)
  })
  return container
}

afterEach(() => {
  for (const root of roots) {
    act(() => { root.unmount() })
  }
  roots.length = 0
  document.body.innerHTML = ''
})

/** A stable anchor rect supplier at a fixed position. */
function anchorRect(overrides: Partial<DOMRect> = {}): () => DOMRect {
  return () =>
    ({ left: 100, top: 190, right: 120, bottom: 200, ...overrides }) as DOMRect
}

// ---------------------------------------------------------------------------
// FileContextMenu
// ---------------------------------------------------------------------------
describe('FileContextMenu', () => {
  test('renders null when open is false', () => {
    render(
      <FileContextMenu
        open={false}
        getAnchorRect={anchorRect()}
        items={[{ id: 'open', label: 'Open', onSelect: vi.fn() }]}
        onClose={vi.fn()}
      />,
    )

    expect(document.body.querySelector('[data-fe-menu]')).toBeNull()
  })

  test('renders items with labels and custom icons when open', () => {
    render(
      <FileContextMenu
        open={true}
        getAnchorRect={anchorRect()}
        items={[
          { id: 'open', label: 'Open', icon: <span data-test-icon="open" />, onSelect: vi.fn() },
          { id: 'copy', label: 'Copy', onSelect: vi.fn() },
        ]}
        onClose={vi.fn()}
      />,
    )

    const menu = document.body.querySelector('[data-fe-menu]')
    expect(menu).not.toBeNull()

    const items = menu!.querySelectorAll('[data-fe-menu-item]')
    expect(items.length).toBe(2)
    expect(items[0].textContent).toContain('Open')
    expect(items[0].querySelector('[data-test-icon="open"]')).not.toBeNull()
    expect(items[1].textContent).toContain('Copy')
  })

  test('portals the menu into document.body, outside the mount container', () => {
    const container = render(
      <FileContextMenu
        open={true}
        getAnchorRect={anchorRect()}
        items={[{ id: 'open', label: 'Open', onSelect: vi.fn() }]}
        onClose={vi.fn()}
      />,
    )

    const menu = document.body.querySelector('[data-fe-menu]') as HTMLElement
    expect(menu).not.toBeNull()
    expect(document.body.contains(menu)).toBe(true)
    expect(container.contains(menu)).toBe(false)
  })

  test('menu is positioned from the anchor rect when open', () => {
    render(
      <FileContextMenu
        open={true}
        getAnchorRect={anchorRect()}
        items={[{ id: 'open', label: 'Open', onSelect: vi.fn() }]}
        onClose={vi.fn()}
      />,
    )

    const menu = document.body.querySelector('[data-fe-menu]') as HTMLElement
    expect(menu).not.toBeNull()
    expect(menu.style.position).toBe('fixed')
    expect(menu.style.left).toBe('100px')
    // Opens below the anchor trigger: anchor.bottom + 4.
    expect(menu.style.top).toBe('204px')
  })

  test('stays hidden when the anchor rect supplier returns null', () => {
    render(
      <FileContextMenu
        open={true}
        getAnchorRect={() => null}
        items={[{ id: 'open', label: 'Open', onSelect: vi.fn() }]}
        onClose={vi.fn()}
      />,
    )

    const menu = document.body.querySelector('[data-fe-menu]') as HTMLElement
    expect(menu).not.toBeNull()
    expect(menu.style.visibility).toBe('hidden')
  })

  test('renders a danger class on items flagged danger', () => {
    render(
      <FileContextMenu
        open={true}
        getAnchorRect={anchorRect()}
        items={[
          { id: 'delete', label: 'Delete', danger: true, onSelect: vi.fn() },
          { id: 'rename', label: 'Rename', onSelect: vi.fn() },
        ]}
        onClose={vi.fn()}
      />,
    )
    const items = document.body.querySelectorAll('[data-fe-menu-item]')
    expect(items[0].className).toContain('dsh-fe-menu-item--danger')
    expect(items[1].className).not.toContain('dsh-fe-menu-item--danger')
  })

  test('clicking an item calls onSelect and then onClose', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()

    render(
      <FileContextMenu
        open={true}
        getAnchorRect={anchorRect()}
        items={[{ id: 'open', label: 'Open', onSelect }]}
        onClose={onClose}
      />,
    )

    const item = document.body.querySelector('[data-fe-menu-item]') as HTMLElement
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
        getAnchorRect={anchorRect()}
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

    render(
      <FileContextMenu
        open={true}
        getAnchorRect={anchorRect()}
        items={[{ id: 'open', label: 'Open', onSelect: vi.fn() }]}
        onClose={onClose}
      />,
    )

    const menu = document.body.querySelector('[data-fe-menu]') as HTMLElement
    act(() => {
      menu.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true }),
      )
    })

    expect(onClose).not.toHaveBeenCalled()
  })

  test('pressing Escape calls onClose', () => {
    const onClose = vi.fn()

    render(
      <FileContextMenu
        open={true}
        getAnchorRect={anchorRect()}
        items={[{ id: 'open', label: 'Open', onSelect: vi.fn() }]}
        onClose={onClose}
      />,
    )

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})