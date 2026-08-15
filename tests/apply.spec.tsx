// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react-dom/test-utils'
import { resolvePreview } from '../src/client/preview/registry.ts'
import { MarkdownPreview } from '../src/client/preview/markdown.tsx'

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
  const unsubscribe = vi.fn(() => {})
  const localeUnsubscribe = vi.fn(() => {})
  const localeDisposers: Array<() => void> = []
  return {
    sessions: {
      list: {
        getSnapshot: vi.fn(() => ({
          current: 's1',
          byId: { s1: { id: 's1', cwd: '/workspace' } },
        })),
        subscribe: vi.fn(() => unsubscribe),
      },
    },
    workspaces: { openPath: vi.fn() },
    locale: {
      register: vi.fn().mockImplementation(() => {
        const dispose = vi.fn(() => {})
        localeDisposers.push(dispose)
        return dispose
      }),
      bind: vi.fn().mockReturnValue((key: string) => key),
      subscribe: vi.fn(() => localeUnsubscribe),
    },
    reflect: { provide: vi.fn() },
    effect: vi.fn((cb: () => () => void) => {
      disposer = cb()
    }),
    _unsubscribe: unsubscribe,
    _localeUnsubscribe: localeUnsubscribe,
    _localeDisposers: localeDisposers,
  }
}

/** Flush microtasks so async state updates settle. */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, 0))
  })
}

describe('apply', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: unknown) => {
        const u = String(url)
        if (u.includes('action=list')) {
          return Promise.resolve({
            json: () => Promise.resolve({ entries: [] }),
          })
        }
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              preview: { kind: 'text', name: 'b.ts', extension: 'ts', content: 'hi', size: 2 },
            }),
        })
      }),
    )
  })

  afterEach(() => {
    if (disposer) {
      act(() => {
        disposer()
      })
    }
    disposer = undefined
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
    document.head.querySelectorAll('[data-fe-style]').forEach((el) => el.remove())
  })

  test('injects the <style data-fe-style> and a data-fe-host div', async () => {
    const fakeCtx = createFakeCtx()

    await act(async () => {
      apply(fakeCtx)
    })

    const style = document.head.querySelector('[data-fe-style]')
    expect(style).not.toBeNull()
    expect(style!.textContent).toContain('.dsh-fe-panel')

    const host = document.body.querySelector('[data-fe-host]')
    expect(host).not.toBeNull()
  })

  test('provides the fileExplorer service with registerPreview, registerFileAction, and writeFile', async () => {
    const fakeCtx = createFakeCtx()

    await act(async () => {
      apply(fakeCtx)
    })

    const provide = fakeCtx.reflect.provide as ReturnType<typeof vi.fn>
    expect(provide).toHaveBeenCalled()
    const call = provide.mock.calls.find((c) => c[0] === 'fileExplorer')
    expect(call).toBeDefined()
    const service = call![1] as { registerPreview?: unknown; registerFileAction?: unknown; writeFile?: unknown }
    expect(typeof service.registerPreview).toBe('function')
    expect(typeof service.registerFileAction).toBe('function')
    expect(typeof service.writeFile).toBe('function')
  })

  test('an external plugin can override a built-in preview via the fileExplorer service', async () => {
    const fakeCtx = createFakeCtx()

    await act(async () => {
      apply(fakeCtx)
    })

    // The built-in markdown preview is registered by apply()'s
    // registerBuiltinPreviews().
    expect(resolvePreview('md')).toBe(MarkdownPreview)

    const provide = fakeCtx.reflect.provide as ReturnType<typeof vi.fn>
    const call = provide.mock.calls.find((c) => c[0] === 'fileExplorer')
    const service = call![1] as { registerPreview(ext: string, comp: unknown, priority?: number): () => void }

    const External = () => null
    const dispose = service.registerPreview('md', External, 10)

    // The higher-priority external preview now wins.
    expect(resolvePreview('md')).toBe(External)

    // Disposing the registration restores the built-in preview.
    dispose()
    expect(resolvePreview('md')).toBe(MarkdownPreview)
  })

  test('renders the floating file button (data-fe-file-button) inside the host', async () => {
    const fakeCtx = createFakeCtx()

    await act(async () => {
      apply(fakeCtx)
    })

    const host = document.body.querySelector('[data-fe-host]')
    expect(host).not.toBeNull()
    expect(host!.querySelector('[data-fe-file-button]')).not.toBeNull()

    // Drawer starts closed.
    expect(document.body.querySelector('[data-fe-drawer]')).toBeNull()
  })

  test('clicking a produced-file chip triggers a preview fetch and opens the drawer and preview panel', async () => {
    const fakeCtx = createFakeCtx()

    await act(async () => {
      apply(fakeCtx)
    })

    // A produced-file chip outside our own tree.
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
    await flush()

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    const previewCall = fetchMock.mock.calls.find((call: any[]) =>
      String(call[0]).includes('action=preview'),
    )
    expect(previewCall).toBeDefined()
    expect(String(previewCall![0])).toContain('sessionId=s1')
    expect(String(previewCall![0])).toContain('path=src%2Fb.ts')

    // The drawer opened and the floating preview panel became visible.
    expect(document.body.querySelector('[data-fe-drawer]')).not.toBeNull()
    const panel = document.querySelector('[data-fe-host] [data-visible]')
    expect(panel).not.toBeNull()
    expect(panel!.getAttribute('data-visible')).toBe('true')
  })

  test('Ctrl/Cmd+Shift+E toggles the drawer', async () => {
    const fakeCtx = createFakeCtx()

    await act(async () => {
      apply(fakeCtx)
    })

    expect(document.body.querySelector('[data-fe-drawer]')).toBeNull()

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

    expect(document.body.querySelector('[data-fe-drawer]')).not.toBeNull()

    // Toggling again closes it.
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

    expect(document.body.querySelector('[data-fe-drawer]')).toBeNull()
  })

  test('disposer removes the host and style and unsubscribes sessions', async () => {
    const fakeCtx = createFakeCtx()

    await act(async () => {
      apply(fakeCtx)
    })

    expect(fakeCtx.sessions.list.subscribe).toHaveBeenCalled()
    expect(fakeCtx._unsubscribe).not.toHaveBeenCalled()

    expect(document.body.querySelector('[data-fe-host]')).not.toBeNull()
    expect(document.head.querySelector('[data-fe-style]')).not.toBeNull()

    expect(disposer).toBeDefined()
    act(() => {
      disposer!()
    })

    expect(document.body.querySelector('[data-fe-host]')).toBeNull()
    expect(document.head.querySelector('[data-fe-style]')).toBeNull()
    expect(fakeCtx._unsubscribe).toHaveBeenCalledTimes(1)
  })

  test('registers locale dictionaries and binds/subscribes the translator', async () => {
    const fakeCtx = createFakeCtx()

    await act(async () => {
      apply(fakeCtx)
    })

    expect(fakeCtx.locale.register).toHaveBeenCalledTimes(2)
    expect(fakeCtx.locale.register).toHaveBeenNthCalledWith(
      1,
      'file-explorer',
      'zh',
      expect.any(Object),
    )
    expect(fakeCtx.locale.register).toHaveBeenNthCalledWith(
      2,
      'file-explorer',
      'en',
      expect.any(Object),
    )
    expect(fakeCtx.locale.bind).toHaveBeenCalledWith('file-explorer')
    expect(fakeCtx.locale.subscribe).toHaveBeenCalledTimes(1)
  })

  test('disposer removes registered locale dictionaries and locale subscription', async () => {
    const fakeCtx = createFakeCtx()

    await act(async () => {
      apply(fakeCtx)
    })

    expect(fakeCtx._localeDisposers).toHaveLength(2)
    expect(fakeCtx._localeUnsubscribe).not.toHaveBeenCalled()

    act(() => {
      disposer!()
    })

    expect(fakeCtx._localeUnsubscribe).toHaveBeenCalledTimes(1)
    for (const dispose of fakeCtx._localeDisposers) {
      expect(dispose).toHaveBeenCalledTimes(1)
    }
  })
})
