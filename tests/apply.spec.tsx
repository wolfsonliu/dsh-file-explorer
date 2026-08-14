// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react-dom/test-utils'

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
        subscribe: vi.fn(() => () => {}),
      },
    },
    workspaces: { openPath: vi.fn() },
    effect: vi.fn((cb: () => () => void) => {
      disposer = cb()
    }),
  }
}

/** Flush microtasks and observer callbacks. */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, 0))
  })
}

/** Append a `[role="tree"]` element and wait for `mountSidebar` to inject its host. */
async function mountSidebarHost(): Promise<HTMLElement> {
  const tree = document.createElement('div')
  tree.setAttribute('role', 'tree')
  document.body.appendChild(tree)

  await vi.waitFor(() => {
    expect(document.body.querySelector('[data-fe-sidebar-host]')).not.toBeNull()
  })

  return document.body.querySelector('[data-fe-sidebar-host]') as HTMLElement
}

describe('apply', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: unknown) => {
        const u = String(url)
        if (u.includes('action=list')) {
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
          json: () =>
            Promise.resolve({
              ok: true,
              preview: { kind: 'text', name: 'f.ts', extension: '.ts', content: 'hi', size: 2 },
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

  test('injects the <style> and the data-fe-preview-host', async () => {
    const fakeCtx = createFakeCtx()

    await act(async () => {
      apply(fakeCtx)
    })

    const style = document.head.querySelector('[data-fe-style]')
    expect(style).not.toBeNull()
    expect(style!.textContent).toContain('.dsh-fe-panel')

    const previewHost = document.body.querySelector('[data-fe-preview-host]')
    expect(previewHost).not.toBeNull()

    // The floating panel starts closed: no visible panel yet.
    expect(previewHost!.querySelector('.dsh-fe-panel')).toBeNull()
  })

  test('after a [role="tree"] appears, injects the sidebar host and the file tree becomes reachable', async () => {
    const fakeCtx = createFakeCtx()

    await act(async () => {
      apply(fakeCtx)
    })

    // No tree yet → no sidebar host.
    expect(document.body.querySelector('[data-fe-sidebar-host]')).toBeNull()

    const sidebarHost = await mountSidebarHost()

    // Tab bar is rendered inside the sidebar host.
    const filesTab = sidebarHost.querySelector('[data-fe-tab="files"]') as HTMLElement
    const sessionsTab = sidebarHost.querySelector('[data-fe-tab="sessions"]') as HTMLElement
    expect(filesTab).not.toBeNull()
    expect(sessionsTab).not.toBeNull()
    expect(sessionsTab.getAttribute('data-fe-active')).toBe('true')

    // Switch to the files tab: the tree fetches and renders entries.
    act(() => {
      filesTab.click()
    })
    await flush()

    expect(filesTab.getAttribute('data-fe-active')).toBe('true')
    expect(sidebarHost.querySelector('[data-fe-tree-visible="true"]')).not.toBeNull()
    expect(sidebarHost.textContent).toContain('README.md')
  })

  test('clicking a produced-file chip triggers a preview fetch and opens the preview panel', async () => {
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

    // The floating panel opened with data-visible="true".
    const panel = document.querySelector('[data-fe-preview-host] .dsh-fe-panel')
    expect(panel).not.toBeNull()
    expect(panel!.getAttribute('data-visible')).toBe('true')
  })

  test('Ctrl/Cmd+Shift+E toggles the sidebar tab to files', async () => {
    const fakeCtx = createFakeCtx()

    await act(async () => {
      apply(fakeCtx)
    })

    const sidebarHost = await mountSidebarHost()
    const filesTab = sidebarHost.querySelector('[data-fe-tab="files"]') as HTMLElement
    const sessionsTab = sidebarHost.querySelector('[data-fe-tab="sessions"]') as HTMLElement
    expect(sessionsTab.getAttribute('data-fe-active')).toBe('true')

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

    expect(filesTab.getAttribute('data-fe-active')).toBe('true')
    expect(sessionsTab.getAttribute('data-fe-active')).toBe('false')
    expect(sidebarHost.querySelector('[data-fe-tree-visible="true"]')).not.toBeNull()
  })

  test('subscribes to the sessions list and re-renders without crashing', async () => {
    const fakeCtx = createFakeCtx()

    await act(async () => {
      apply(fakeCtx)
    })

    const list = fakeCtx.sessions.list as unknown as {
      getSnapshot: ReturnType<typeof vi.fn>
      subscribe: ReturnType<typeof vi.fn>
    }
    expect(list.subscribe).toHaveBeenCalled()

    const subscribeCb = list.subscribe.mock.calls[0][0] as () => void
    ;(list.getSnapshot as ReturnType<typeof vi.fn>).mockReturnValue({
      current: 's2',
      byId: { s2: { id: 's2', cwd: '/other' } },
    })

    await act(async () => {
      subscribeCb()
    })

    expect(document.body.querySelector('[data-fe-preview-host]')).not.toBeNull()
  })

  test('disposer removes both hosts and the style', async () => {
    const fakeCtx = createFakeCtx()

    await act(async () => {
      apply(fakeCtx)
    })

    await mountSidebarHost()

    expect(document.body.querySelector('[data-fe-preview-host]')).not.toBeNull()
    expect(document.body.querySelector('[data-fe-sidebar-host]')).not.toBeNull()
    expect(document.head.querySelector('[data-fe-style]')).not.toBeNull()

    expect(disposer).toBeDefined()
    act(() => {
      disposer!()
    })

    expect(document.body.querySelector('[data-fe-preview-host]')).toBeNull()
    expect(document.body.querySelector('[data-fe-sidebar-host]')).toBeNull()
    expect(document.head.querySelector('[data-fe-style]')).toBeNull()
  })
})
