// @vitest-environment jsdom
import { describe, expect, test } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import React from 'react'
import { FileExplorerPanel } from '../src/client/panel.tsx'

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

// jsdom does not implement setPointerCapture / releasePointerCapture.
if (!('setPointerCapture' in Element.prototype)) {
  ;(Element.prototype as any).setPointerCapture = function (_pointerId: number) {
    // no-op in jsdom
  }
  ;(Element.prototype as any).releasePointerCapture = function (_pointerId: number) {
    // no-op in jsdom
  }
  ;(Element.prototype as any).hasPointerCapture = function (_pointerId: number) {
    return false
  }
}

// jsdom's requestAnimationFrame does not fire; make it synchronous for tests.
globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
  cb(0)
  return 0
}
globalThis.cancelAnimationFrame = (_handle: number): void => {
  // no-op
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
// FileExplorerPanel
// ---------------------------------------------------------------------------
describe('FileExplorerPanel', () => {
  test('renders null when visible is false (default)', () => {
    const container = render(
      <FileExplorerPanel tree={<span>Tree</span>} preview={<span>Preview</span>} />,
    )
    // The panel root should not exist in the DOM
    const panel = container.querySelector('[data-visible]')
    expect(panel).toBeNull()
  })

  test('renders panel when initialVisible is true', () => {
    const container = render(
      <FileExplorerPanel
        initialVisible
        tree={<span>Tree</span>}
        preview={<span>Preview</span>}
      />,
    )
    const panel = container.querySelector('[data-visible]')
    expect(panel).not.toBeNull()
    expect(panel!.getAttribute('data-visible')).toBe('true')
  })

  test('clicking close button sets data-visible to false', () => {
    const container = render(
      <FileExplorerPanel
        initialVisible
        tree={<span>Tree</span>}
        preview={<span>Preview</span>}
      />,
    )
    const panel = container.querySelector('[data-visible]') as HTMLElement
    expect(panel).not.toBeNull()

    const closeBtn = panel.querySelector('[data-fe-action="close"]') as HTMLElement
    expect(closeBtn).not.toBeNull()

    act(() => {
      closeBtn.click()
    })

    // After close, the panel is removed from DOM
    const panelAfter = container.querySelector('[data-visible]')
    expect(panelAfter).toBeNull()
  })

  test('clicking minimize toggles data-minimized attribute', () => {
    const container = render(
      <FileExplorerPanel
        initialVisible
        tree={<span>Tree</span>}
        preview={<span>Preview</span>}
      />,
    )
    const panel = container.querySelector('[data-visible]') as HTMLElement
    expect(panel).not.toBeNull()
    expect(panel.getAttribute('data-minimized')).toBe('false')

    const minimizeBtn = panel.querySelector('[data-fe-action="minimize"]') as HTMLElement
    expect(minimizeBtn).not.toBeNull()

    act(() => {
      minimizeBtn.click()
    })

    expect(panel.getAttribute('data-minimized')).toBe('true')

    // Body should be hidden when minimized
    const body = panel.querySelector('[data-fe-body]')
    expect(body).toBeNull() // body is not rendered when minimized

    // But title bar should still be visible
    const titleBar = panel.querySelector('[data-fe-title-bar]')
    expect(titleBar).not.toBeNull()

    // Click again to restore
    act(() => {
      minimizeBtn.click()
    })

    expect(panel.getAttribute('data-minimized')).toBe('false')
    const bodyRestored = panel.querySelector('[data-fe-body]')
    expect(bodyRestored).not.toBeNull()
  })

  test('clicking maximize toggles data-maximized attribute', () => {
    const container = render(
      <FileExplorerPanel
        initialVisible
        tree={<span>Tree</span>}
        preview={<span>Preview</span>}
      />,
    )
    const panel = container.querySelector('[data-visible]') as HTMLElement
    expect(panel).not.toBeNull()
    expect(panel.getAttribute('data-maximized')).toBe('false')

    const maximizeBtn = panel.querySelector('[data-fe-action="maximize"]') as HTMLElement
    expect(maximizeBtn).not.toBeNull()

    act(() => {
      maximizeBtn.click()
    })

    expect(panel.getAttribute('data-maximized')).toBe('true')

    // Click again to restore
    act(() => {
      maximizeBtn.click()
    })

    expect(panel.getAttribute('data-maximized')).toBe('false')
  })

  test('renders tree and preview ReactNodes inside the body', () => {
    const container = render(
      <FileExplorerPanel
        initialVisible
        tree={<span data-testid="tree-content">Tree Content</span>}
        preview={<span data-testid="preview-content">Preview Content</span>}
      />,
    )
    const panel = container.querySelector('[data-visible]') as HTMLElement
    expect(panel).not.toBeNull()

    const treePane = panel.querySelector('[data-fe-pane="tree"]')
    expect(treePane).not.toBeNull()
    expect(treePane!.textContent).toContain('Tree Content')

    const previewPane = panel.querySelector('[data-fe-pane="preview"]')
    expect(previewPane).not.toBeNull()
    expect(previewPane!.textContent).toContain('Preview Content')
  })

  test('title bar drag updates position via pointer events', () => {
    const container = render(
      <FileExplorerPanel
        initialVisible
        tree={<span>Tree</span>}
        preview={<span>Preview</span>}
      />,
    )
    const panel = container.querySelector('[data-visible]') as HTMLElement
    expect(panel).not.toBeNull()

    const titleBar = panel.querySelector('[data-fe-title-bar]') as HTMLElement
    expect(titleBar).not.toBeNull()

    // Initial position should be set (default 80,80)
    const initialLeft = panel.style.left
    const initialTop = panel.style.top
    expect(initialLeft).toBeTruthy()
    expect(initialTop).toBeTruthy()

    // Simulate pointer events on the title bar
    act(() => {
      titleBar.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 100,
          clientY: 100,
          bubbles: true,
        }),
      )
    })

    act(() => {
      document.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: 150,
          clientY: 130,
          bubbles: true,
        }),
      )
    })

    act(() => {
      document.dispatchEvent(
        new PointerEvent('pointerup', {
          clientX: 150,
          clientY: 130,
          bubbles: true,
        }),
      )
    })

    // After drag, position should have changed
    // The delta is (50, 30), so position should move from (80,80) to (130,110)
    expect(panel.style.left).not.toBe(initialLeft)
    expect(panel.style.top).not.toBe(initialTop)
  })

  test('divider drag resizes tree pane width', () => {
    const container = render(
      <FileExplorerPanel
        initialVisible
        tree={<span>Tree</span>}
        preview={<span>Preview</span>}
      />,
    )
    const panel = container.querySelector('[data-visible]') as HTMLElement
    expect(panel).not.toBeNull()

    const divider = panel.querySelector('[data-fe-divider]') as HTMLElement
    expect(divider).not.toBeNull()

    const treePane = panel.querySelector('[data-fe-pane="tree"]') as HTMLElement
    expect(treePane).not.toBeNull()
    const initialWidth = treePane.style.width

    // Simulate divider drag
    act(() => {
      divider.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 300,
          clientY: 200,
          bubbles: true,
        }),
      )
    })

    act(() => {
      document.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: 350,
          clientY: 200,
          bubbles: true,
        }),
      )
    })

    act(() => {
      document.dispatchEvent(
        new PointerEvent('pointerup', {
          clientX: 350,
          clientY: 200,
          bubbles: true,
        }),
      )
    })

    // After divider drag, tree pane width should have changed
    expect(treePane.style.width).not.toBe(initialWidth)
  })
})