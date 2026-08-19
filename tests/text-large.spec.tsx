// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import type { ReactElement } from 'react'
import { makeTextPagedPreview } from '../src/client/preview/text-large.tsx'

/** Render a React element into a jsdom container and return the container. */
function render(element: ReactElement): HTMLElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(element)
  })
  return container
}

/** Flush pending microtasks so async read/state updates settle. */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, 0))
  })
}

const props = (overrides: Record<string, unknown> = {}) => ({
  preview: { kind: 'text-large', name: 'big.txt', extension: '.txt', size: 6000000 },
  filePath: '/ws/big.txt',
  t: (key: string) => key,
  activeView: 'preview',
  ...overrides,
})

describe('makeTextPagedPreview', () => {
  test('renders a text-large preview and loads the first chunk', async () => {
    const readRaw = vi.fn().mockImplementation((_p: string, offset = 0) => {
      const text = offset === 0 ? 'AAAA' : 'BBBB'
      return Promise.resolve(new TextEncoder().encode(text).buffer as ArrayBuffer)
    })
    const Comp = makeTextPagedPreview(readRaw)
    const container = render(<Comp {...props()} />)
    expect(container.querySelector('[data-fe-text-large]')).not.toBeNull()
    await flush()
    expect(container.textContent).toContain('AAAA')
  })

  test('appends the next chunk on Load more', async () => {
    const readRaw = vi.fn().mockImplementation((_p: string, offset = 0) => {
      const text = offset === 0 ? 'AAAA' : 'BBBB'
      return Promise.resolve(new TextEncoder().encode(text).buffer as ArrayBuffer)
    })
    const Comp = makeTextPagedPreview(readRaw)
    const container = render(<Comp {...props()} />)
    // Let the first chunk (offset 0) settle so "Load more" reads from offset 4.
    await flush()
    act(() => container.querySelector('[data-fe-load-more]')!.click())
    await flush()
    expect(container.textContent).toContain('AAAABBBB')
  })

  test('shows an error message when the read fails', async () => {
    const readRaw = vi.fn().mockRejectedValue(new Error('boom'))
    const Comp = makeTextPagedPreview(readRaw)
    const container = render(<Comp {...props()} />)
    await flush()
    expect(container.textContent).toContain('boom')
  })

  test('falls back to StatusPreview (too-large) when readRawFile is undefined', () => {
    const Comp = makeTextPagedPreview(undefined)
    const container = render(<Comp {...props()} />)
    expect(container.textContent).toContain('tooLarge')
  })

  test('renders kind "text" as a plain pre/code', () => {
    const Comp = makeTextPagedPreview(undefined)
    const container = render(
      <Comp
        preview={{ kind: 'text', name: 'a.txt', extension: '.txt', content: 'hello', size: 5 }}
        filePath="/ws/a.txt"
        t={(key: string) => key}
        activeView="preview"
      />,
    )
    const code = container.querySelector('pre.dsh-fe-code code')
    expect(code).toBeTruthy()
    expect(code!.textContent).toBe('hello')
  })
})
