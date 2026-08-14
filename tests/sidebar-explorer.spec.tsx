// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import React, { createRef } from 'react'
import { SidebarExplorer, type SidebarExplorerHandle } from '../src/client/sidebar-explorer.tsx'
import type { BrowserEntry } from '../src/protocol.ts'

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

/** Flush all pending microtasks so async state updates settle. */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, 0))
  })
}

const rootEntries: BrowserEntry[] = [
  { name: 'README.md', path: 'README.md', kind: 'file', size: 100 },
]

// ---------------------------------------------------------------------------
// SidebarExplorer
// ---------------------------------------------------------------------------
describe('SidebarExplorer', () => {
  test('「会话」 tab is active by default and the file tree is hidden', () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const onSelectFile = vi.fn()

    const container = render(
      <SidebarExplorer sessionId="s1" fetchList={fetchList} onSelectFile={onSelectFile} />,
    )

    const sessionsTab = container.querySelector('[data-fe-tab="sessions"]')
    const filesTab = container.querySelector('[data-fe-tab="files"]')
    expect(sessionsTab).not.toBeNull()
    expect(filesTab).not.toBeNull()

    // 「会话」 active by default
    expect(sessionsTab!.getAttribute('data-fe-active')).toBe('true')
    expect(filesTab!.getAttribute('data-fe-active')).toBe('false')

    // No file tree in the DOM
    expect(container.querySelector('[data-fe-tree-visible="true"]')).toBeNull()

    // Tree must not have been fetched
    expect(fetchList).not.toHaveBeenCalled()
  })

  test('clicking 「文件」 shows the tree and fetches the root listing', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const onSelectFile = vi.fn()

    const container = render(
      <SidebarExplorer sessionId="s1" fetchList={fetchList} onSelectFile={onSelectFile} />,
    )

    const filesTab = container.querySelector('[data-fe-tab="files"]') as HTMLElement
    expect(filesTab).not.toBeNull()

    act(() => {
      filesTab.click()
    })

    // Tab state flips
    expect(filesTab.getAttribute('data-fe-active')).toBe('true')
    expect(
      container.querySelector('[data-fe-tab="sessions"]')!.getAttribute('data-fe-active'),
    ).toBe('false')

    // Tree container rendered with visibility marker
    const tree = container.querySelector('[data-fe-tree-visible="true"]')
    expect(tree).not.toBeNull()
    expect(tree!.classList.contains('dsh-fe-sidebar-tree')).toBe(true)

    // Root listing fetched via FileTree
    expect(fetchList).toHaveBeenCalledWith('s1', '')

    await flush()

    expect(container.querySelector('.dsh-fe-tree-row')).not.toBeNull()
  })

  test('clicking 「会话」 hides the tree again', () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const onSelectFile = vi.fn()

    const container = render(
      <SidebarExplorer sessionId="s1" fetchList={fetchList} onSelectFile={onSelectFile} />,
    )

    const filesTab = container.querySelector('[data-fe-tab="files"]') as HTMLElement
    act(() => {
      filesTab.click()
    })
    expect(container.querySelector('[data-fe-tree-visible="true"]')).not.toBeNull()

    const sessionsTab = container.querySelector('[data-fe-tab="sessions"]') as HTMLElement
    act(() => {
      sessionsTab.click()
    })

    expect(container.querySelector('[data-fe-tree-visible="true"]')).toBeNull()
    expect(sessionsTab.getAttribute('data-fe-active')).toBe('true')
  })

  test('clicking a file row calls onSelectFile with the path', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const onSelectFile = vi.fn()

    const container = render(
      <SidebarExplorer sessionId="s1" fetchList={fetchList} onSelectFile={onSelectFile} />,
    )

    const filesTab = container.querySelector('[data-fe-tab="files"]') as HTMLElement
    act(() => {
      filesTab.click()
    })
    await flush()

    const row = container.querySelector('.dsh-fe-tree-row') as HTMLElement
    expect(row).not.toBeNull()

    act(() => {
      row.click()
    })

    expect(onSelectFile).toHaveBeenCalledWith('README.md')
  })

  test('calling showFiles via the ref switches to the files tab', () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const onSelectFile = vi.fn()
    const ref = createRef<SidebarExplorerHandle>()

    const container = render(
      <SidebarExplorer ref={ref} sessionId="s1" fetchList={fetchList} onSelectFile={onSelectFile} />,
    )

    // 「会话」 active by default
    expect(
      container.querySelector('[data-fe-tab="sessions"]')!.getAttribute('data-fe-active'),
    ).toBe('true')

    act(() => {
      ref.current!.showFiles()
    })

    expect(
      container.querySelector('[data-fe-tab="files"]')!.getAttribute('data-fe-active'),
    ).toBe('true')
    expect(
      container.querySelector('[data-fe-tab="sessions"]')!.getAttribute('data-fe-active'),
    ).toBe('false')
    expect(container.querySelector('[data-fe-tree-visible="true"]')).not.toBeNull()
  })

  test('calling showSessions via the ref switches back to the sessions tab', () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const onSelectFile = vi.fn()
    const ref = createRef<SidebarExplorerHandle>()

    const container = render(
      <SidebarExplorer ref={ref} sessionId="s1" fetchList={fetchList} onSelectFile={onSelectFile} />,
    )

    act(() => {
      ref.current!.showFiles()
    })
    act(() => {
      ref.current!.showSessions()
    })

    expect(
      container.querySelector('[data-fe-tab="sessions"]')!.getAttribute('data-fe-active'),
    ).toBe('true')
    expect(container.querySelector('[data-fe-tree-visible="true"]')).toBeNull()
  })
})
