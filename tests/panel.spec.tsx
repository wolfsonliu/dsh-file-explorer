// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import React from 'react'
import {
  clampToViewport,
  FileExplorerPanel,
  TITLE_BAR_HEIGHT,
} from '../src/client/panel.tsx'

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
// Viewport clamp helpers
// ---------------------------------------------------------------------------

const DEFAULT_INNER_WIDTH = window.innerWidth
const DEFAULT_INNER_HEIGHT = window.innerHeight

/** Fix the jsdom viewport so pointer/resize clamping is deterministic. */
function setViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
}

/** Perform a pointerdown → pointermove → pointerup title drag. */
function dragTitle(
  titleText: HTMLElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
): void {
  act(() => {
    titleText.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: from.x, clientY: from.y, bubbles: true }),
    )
  })
  act(() => {
    document.dispatchEvent(
      new PointerEvent('pointermove', { clientX: to.x, clientY: to.y, bubbles: true }),
    )
  })
  act(() => {
    document.dispatchEvent(
      new PointerEvent('pointerup', { clientX: to.x, clientY: to.y, bubbles: true }),
    )
  })
}

afterEach(() => {
  setViewport(DEFAULT_INNER_WIDTH, DEFAULT_INNER_HEIGHT)
})

// ---------------------------------------------------------------------------
// clampToViewport (pure function)
// ---------------------------------------------------------------------------
describe('clampToViewport', () => {
  const size = { width: 640, height: 480 }

  test('returns a legal position unchanged', () => {
    const viewport = { width: 1000, height: 700 }
    expect(clampToViewport({ x: 80, y: 80 }, size, viewport)).toEqual({ x: 80, y: 80 })
  })

  test('clamps a negative top to 0', () => {
    const viewport = { width: 1000, height: 700 }
    expect(clampToViewport({ x: 80, y: -100 }, size, viewport)).toEqual({ x: 80, y: 0 })
  })

  test('clamps top past the lower bound to viewport height minus title bar height', () => {
    const viewport = { width: 1000, height: 700 }
    expect(clampToViewport({ x: 80, y: 900 }, size, viewport)).toEqual({
      x: 80,
      y: viewport.height - TITLE_BAR_HEIGHT,
    })
  })

  test('clamps a negative left to 0', () => {
    const viewport = { width: 1000, height: 700 }
    expect(clampToViewport({ x: -100, y: 80 }, size, viewport)).toEqual({ x: 0, y: 80 })
  })

  test('clamps left past the right bound to viewport width minus size width', () => {
    const viewport = { width: 1000, height: 700 }
    expect(clampToViewport({ x: 900, y: 80 }, size, viewport)).toEqual({
      x: viewport.width - size.width,
      y: 80,
    })
  })

  test('clamps left to 0 when size width >= viewport width', () => {
    const viewport = { width: 1000, height: 700 }
    const oversized = { width: 1200, height: 480 }
    expect(clampToViewport({ x: 50, y: 80 }, oversized, viewport)).toEqual({ x: 0, y: 80 })
  })

  test('clamps top to 0 when viewport height < title bar height', () => {
    const viewport = { width: 1000, height: 10 }
    expect(clampToViewport({ x: 80, y: 80 }, size, viewport)).toEqual({ x: 80, y: 0 })
  })
})

// ---------------------------------------------------------------------------
// FileExplorerPanel
// ---------------------------------------------------------------------------
describe('FileExplorerPanel', () => {
  test('renders null when visible is false (default)', () => {
    const container = render(
      <FileExplorerPanel t={t}>
        <span>Preview</span>
      </FileExplorerPanel>,
    )
    // The panel root should not exist in the DOM
    const panel = container.querySelector('[data-visible]')
    expect(panel).toBeNull()
  })

  test('renders panel when initialVisible is true', () => {
    const container = render(
      <FileExplorerPanel initialVisible t={t}>
        <span>Preview</span>
      </FileExplorerPanel>,
    )
    const panel = container.querySelector('[data-visible]')
    expect(panel).not.toBeNull()
    expect(panel!.getAttribute('data-visible')).toBe('true')
  })

  test('renders children content inside the body', () => {
    const container = render(
      <FileExplorerPanel initialVisible t={t}>
        <span data-testid="preview-content">Preview Content</span>
      </FileExplorerPanel>,
    )
    const panel = container.querySelector('[data-visible]') as HTMLElement
    expect(panel).not.toBeNull()

    expect(panel.textContent).toContain('Preview Content')
  })

  test('renders localized default title when title prop is not provided', () => {
    const container = render(
      <FileExplorerPanel initialVisible t={t}>
        <span>Preview</span>
      </FileExplorerPanel>,
    )
    const titleText = container.querySelector('.dsh-fe-title-text') as HTMLElement
    expect(titleText).not.toBeNull()
    expect(titleText.textContent).toBe('title')
  })

  test('renders custom title when title prop is provided', () => {
    const container = render(
      <FileExplorerPanel initialVisible t={t} title="My Panel">
        <span>Preview</span>
      </FileExplorerPanel>,
    )
    const titleText = container.querySelector('.dsh-fe-title-text') as HTMLElement
    expect(titleText).not.toBeNull()
    expect(titleText.textContent).toBe('My Panel')
  })

  test('does not render a tree pane, divider, or preview pane', () => {
    const container = render(
      <FileExplorerPanel initialVisible t={t}>
        <span data-testid="preview-content">Preview Content</span>
      </FileExplorerPanel>,
    )
    const panel = container.querySelector('[data-visible]') as HTMLElement
    expect(panel).not.toBeNull()

    expect(panel.querySelector('[data-fe-pane="tree"]')).toBeNull()
    expect(panel.querySelector('[data-fe-pane="preview"]')).toBeNull()
    expect(panel.querySelector('[data-fe-divider]')).toBeNull()
  })

  test('clicking close button sets data-visible to false', () => {
    const container = render(
      <FileExplorerPanel initialVisible t={t}>
        <span>Preview</span>
      </FileExplorerPanel>,
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

  test('calls onClose before closing when the close button is clicked', () => {
    let panelMountedAtClose = false
    const onClose = vi.fn(() => {
      panelMountedAtClose = container.querySelector('[data-visible]') !== null
    })
    const container = render(
      <FileExplorerPanel initialVisible t={t} onClose={onClose}>
        <span>Preview</span>
      </FileExplorerPanel>,
    )
    const panel = container.querySelector('[data-visible]') as HTMLElement
    const closeBtn = panel.querySelector('[data-fe-action="close"]') as HTMLElement
    expect(closeBtn).not.toBeNull()

    act(() => closeBtn.click())

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(panelMountedAtClose).toBe(true)
    expect(container.querySelector('[data-visible]')).toBeNull()
  })

  test('title bar has no minimize button and no data-minimized attribute', () => {
    const container = render(
      <FileExplorerPanel initialVisible t={t}>
        <span>Preview</span>
      </FileExplorerPanel>,
    )
    const panel = container.querySelector('[data-visible]') as HTMLElement
    expect(panel).not.toBeNull()

    expect(panel.querySelector('[data-fe-action="minimize"]')).toBeNull()
    expect(panel.hasAttribute('data-minimized')).toBe(false)
    expect(panel.querySelector('[data-fe-action="maximize"]')).not.toBeNull()
    expect(panel.querySelector('[data-fe-action="close"]')).not.toBeNull()
  })

  test('clicking maximize toggles data-maximized attribute', () => {
    const container = render(
      <FileExplorerPanel initialVisible t={t}>
        <span>Preview</span>
      </FileExplorerPanel>,
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

  test('title text drag updates position via pointer events', () => {
    const container = render(
      <FileExplorerPanel initialVisible t={t}>
        <span>Preview</span>
      </FileExplorerPanel>,
    )
    const panel = container.querySelector('[data-visible]') as HTMLElement
    expect(panel).not.toBeNull()

    const titleText = panel.querySelector('.dsh-fe-title-text') as HTMLElement
    expect(titleText).not.toBeNull()

    const initialLeft = panel.style.left
    const initialTop = panel.style.top
    expect(initialLeft).toBeTruthy()
    expect(initialTop).toBeTruthy()

    act(() => {
      titleText.dispatchEvent(
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

    expect(panel.style.left).not.toBe(initialLeft)
    expect(panel.style.top).not.toBe(initialTop)
  })

  test('drag above viewport clamps top to 0', () => {
    setViewport(1000, 700)
    const container = render(
      <FileExplorerPanel initialVisible t={t}>
        <span>Preview</span>
      </FileExplorerPanel>,
    )
    const panel = container.querySelector('[data-visible]') as HTMLElement
    const titleText = panel.querySelector('.dsh-fe-title-text') as HTMLElement
    expect(titleText).not.toBeNull()

    dragTitle(titleText, { x: 100, y: 100 }, { x: 100, y: -500 })

    expect(panel.style.top).toBe('0px')
  })

  test('drag beyond bottom-right clamps to viewport bounds', () => {
    setViewport(1000, 700)
    const container = render(
      <FileExplorerPanel initialVisible t={t}>
        <span>Preview</span>
      </FileExplorerPanel>,
    )
    const panel = container.querySelector('[data-visible]') as HTMLElement
    const titleText = panel.querySelector('.dsh-fe-title-text') as HTMLElement
    expect(titleText).not.toBeNull()

    dragTitle(titleText, { x: 100, y: 100 }, { x: 2000, y: 2000 })

    expect(panel.style.left).toBe('360px')
    expect(panel.style.top).toBe('668px')
  })

  test('window resize re-clamps an out-of-bounds panel', () => {
    setViewport(1000, 700)
    const container = render(
      <FileExplorerPanel initialVisible t={t}>
        <span>Preview</span>
      </FileExplorerPanel>,
    )
    const panel = container.querySelector('[data-visible]') as HTMLElement
    const titleText = panel.querySelector('.dsh-fe-title-text') as HTMLElement
    expect(titleText).not.toBeNull()

    dragTitle(titleText, { x: 100, y: 100 }, { x: 2000, y: 2000 })
    expect(panel.style.left).toBe('360px')
    expect(panel.style.top).toBe('668px')

    setViewport(1000, 400)
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(panel.style.top).toBe('368px')

    setViewport(500, 400)
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(panel.style.left).toBe('0px')
  })

  test('resize handle drag updates panel size', () => {
    const container = render(
      <FileExplorerPanel initialVisible t={t}>
        <span>Preview</span>
      </FileExplorerPanel>,
    )
    const panel = container.querySelector('[data-visible]') as HTMLElement
    expect(panel).not.toBeNull()

    const handle = panel.querySelector('[data-fe-resize]') as HTMLElement
    expect(handle).not.toBeNull()

    const initialWidth = panel.style.width
    const initialHeight = panel.style.height

    act(() => {
      handle.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: 640, clientY: 480, bubbles: true }),
      )
    })
    act(() => {
      document.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 700, clientY: 520, bubbles: true }),
      )
    })
    act(() => {
      document.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true }),
      )
    })

    expect(panel.style.width).not.toBe(initialWidth)
    expect(panel.style.height).not.toBe(initialHeight)
  })
})
