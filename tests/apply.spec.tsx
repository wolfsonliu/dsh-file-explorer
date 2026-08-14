// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react-dom/test-utils'

// Stub navigator.clipboard — jsdom does not implement it
beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
    writable: true,
  })
})

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

// jsdom setPointerCapture polyfill
if (!('setPointerCapture' in Element.prototype)) {
  ;(Element.prototype as any).setPointerCapture = function () {}
  ;(Element.prototype as any).releasePointerCapture = function () {}
  ;(Element.prototype as any).hasPointerCapture = function () { return false }
}

// jsdom rAF polyfill
globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => { cb(0); return 0 }
globalThis.cancelAnimationFrame = (_handle: number): void => {}

// ---------------------------------------------------------------------------
// Dynamic import of apply — must be after polyfills
// ---------------------------------------------------------------------------
let apply: (ctx: any) => void
let disposer: (() => void) | undefined

beforeEach(async () => {
  disposer = undefined
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = await import('../src/client/index.ts')
  apply = mod.apply
})

function createFakeCtx() {
  return {
    sessions: {
      list: {
        getSnapshot: vi.fn(() => ({
          current: 's1',
          byId: { s1: { id: 's1', cwd: '/workspace' } },
        })),
      },
    },
    workspaces: { openPath: vi.fn() },
    effect: vi.fn((cb: () => () => void) => {
      disposer = cb()
    }),
  }
}

describe('apply', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ ok: true, preview: { kind: 'text', name: 'f.ts', extension: '.ts', content: 'hi', size: 2 } }),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    // Clean up DOM
    document.body.innerHTML = ''
  })

  test('appends a host div to document.body', async () => {
    const fakeCtx = createFakeCtx()

    await act(async () => {
      apply(fakeCtx)
    })

    const host = document.body.querySelector('[data-fe-host]')
    expect(host).not.toBeNull()
  })

  test('effect disposer removes the host div from body', async () => {
    const fakeCtx = createFakeCtx()

    await act(async () => {
      apply(fakeCtx)
    })

    const host = document.body.querySelector('[data-fe-host]')
    expect(host).not.toBeNull()

    // Call the disposer returned by effect
    expect(disposer).toBeDefined()
    act(() => {
      disposer!()
    })

    expect(document.body.querySelector('[data-fe-host]')).toBeNull()
  })

  test('dispatching click on produced-file button calls preview fetch', async () => {
    const fakeCtx = createFakeCtx()

    await act(async () => {
      apply(fakeCtx)
    })

    // Create a produced-file chip in the DOM
    const container = document.createElement('div')
    container.innerHTML = `
      <div data-produced-files-row>
        <button class="some_file_xyz" title="src/b.ts">📄</button>
      </div>
    `
    document.body.appendChild(container)

    const button = container.querySelector('button') as HTMLButtonElement

    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    // The capture-phase listener should have intercepted the click
    // and triggered a fetch to the preview API
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    expect(fetchMock).toHaveBeenCalled()

    // The first call should be the preview fetch
    const previewCall = fetchMock.mock.calls.find((call: any[]) =>
      String(call[0]).includes('action=preview'),
    )
    expect(previewCall).toBeDefined()
    expect(String(previewCall![0])).toContain('sessionId=s1')
    expect(String(previewCall![0])).toContain('path=src%2Fb.ts')
  })

  test('right-clicking a file row in the tree shows the context menu', async () => {
    // Override the existing fetch stub to return file entries for list action
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes('action=list')) {
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              entries: [
                { name: 'src', path: 'src', kind: 'directory' },
                { name: 'README.md', path: 'README.md', kind: 'file', size: 100 },
              ],
            }),
        })
      }
      return Promise.resolve({
        json: () => Promise.resolve({ ok: true, preview: { kind: 'text', name: 'f.ts', extension: '.ts', content: 'hi', size: 2 } }),
      })
    })

    const fakeCtx = createFakeCtx()

    await act(async () => {
      apply(fakeCtx)
    })

    // Open the panel via Ctrl+Shift+E keyboard shortcut
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'E',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
        }),
      )
    })

    // Wait for the async fetch and state updates to settle
    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 0))
    })

    // Find the file row
    const rows = document.querySelectorAll('.dsh-fe-tree-row')
    const readmeRow = Array.from(rows).find((r) =>
      r.textContent!.includes('README.md'),
    ) as HTMLElement
    expect(readmeRow).toBeTruthy()

    // Right-click the file row
    await act(async () => {
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 150,
        clientY: 250,
      })
      readmeRow.dispatchEvent(event)
    })

    // The context menu should now be visible
    const menu = document.querySelector('[role="menu"]')
    expect(menu).not.toBeNull()

    // It should have three menu items
    const items = menu!.querySelectorAll('[role="menuitem"]')
    expect(items.length).toBe(3)
    expect(items[0].textContent).toBe('打开')
    expect(items[1].textContent).toBe('复制路径')
    expect(items[2].textContent).toBe('复制相对路径')
  })
})