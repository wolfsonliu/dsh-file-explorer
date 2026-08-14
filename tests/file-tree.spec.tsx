// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import React from 'react'
import { FileTree } from '../src/client/file-tree.tsx'
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
  { name: 'src', path: 'src', kind: 'directory' },
  { name: 'README.md', path: 'README.md', kind: 'file', size: 100 },
  { name: 'package.json', path: 'package.json', kind: 'file', size: 200 },
]

const srcChildren: BrowserEntry[] = [
  { name: 'index.ts', path: 'src/index.ts', kind: 'file', size: 50 },
  { name: 'utils', path: 'src/utils', kind: 'directory' },
]

// ---------------------------------------------------------------------------
// FileTree
// ---------------------------------------------------------------------------
describe('FileTree', () => {
  test('renders root entries with dirs sorted before files', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const onSelectFile = vi.fn()

    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} onSelectFile={onSelectFile} />,
    )

    // Root fetch should have been triggered on mount
    expect(fetchList).toHaveBeenCalledWith('s1', '')

    // Wait for the async fetch to resolve and state to update
    await flush()

    const rows = container.querySelectorAll('.dsh-fe-tree-row')
    expect(rows.length).toBe(3)

    // First row: directory "src" (dirs before files)
    expect(rows[0].textContent).toContain('src')
    expect(rows[0].querySelector('.dsh-fe-disclosure')).toBeTruthy()

    // Second row: file "README.md"
    expect(rows[1].textContent).toContain('README.md')
    expect(rows[1].querySelector('.dsh-fe-disclosure')).toBeNull()

    // Third row: file "package.json"
    expect(rows[2].textContent).toContain('package.json')
  })

  test('clicking a file row calls onSelectFile with the file path', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const onSelectFile = vi.fn()

    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} onSelectFile={onSelectFile} />,
    )
    await flush()

    // Find the README.md file row
    const rows = container.querySelectorAll('.dsh-fe-tree-row')
    const readmeRow = Array.from(rows).find((r) =>
      r.textContent!.includes('README.md'),
    ) as HTMLElement
    expect(readmeRow).toBeTruthy()

    act(() => {
      readmeRow.click()
    })

    expect(onSelectFile).toHaveBeenCalledWith('README.md')
  })

  test('clicking a directory row first time fetches children and reveals them', async () => {
    const fetchList = vi
      .fn()
      .mockResolvedValueOnce(rootEntries) // root
      .mockResolvedValueOnce(srcChildren) // src children

    const onSelectFile = vi.fn()

    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} onSelectFile={onSelectFile} />,
    )
    await flush()

    // Find the "src" directory row
    const rows = container.querySelectorAll('.dsh-fe-tree-row')
    const srcRow = Array.from(rows).find((r) =>
      r.textContent!.includes('src'),
    ) as HTMLElement
    expect(srcRow).toBeTruthy()

    // Click the disclosure triangle to expand
    const disclosure = srcRow.querySelector('.dsh-fe-disclosure') as HTMLElement
    expect(disclosure).toBeTruthy()

    act(() => {
      disclosure.click()
    })

    // Should have called fetchList for src
    expect(fetchList).toHaveBeenCalledWith('s1', 'src')

    await flush()

    // Now children should be visible
    const allRows = container.querySelectorAll('.dsh-fe-tree-row')
    expect(allRows.length).toBe(5) // 3 root + 2 children

    // Children should contain the expected names
    const childTexts = Array.from(allRows).map((r) => r.textContent)
    expect(childTexts.some((t) => t!.includes('index.ts'))).toBe(true)
    expect(childTexts.some((t) => t!.includes('utils'))).toBe(true)
  })

  test('clicking the same directory again does NOT re-fetch (cached)', async () => {
    const fetchList = vi
      .fn()
      .mockResolvedValueOnce(rootEntries) // root
      .mockResolvedValueOnce(srcChildren) // src children (first expand)

    const onSelectFile = vi.fn()

    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} onSelectFile={onSelectFile} />,
    )
    await flush()

    const rows = container.querySelectorAll('.dsh-fe-tree-row')
    const srcRow = Array.from(rows).find((r) =>
      r.textContent!.includes('src'),
    ) as HTMLElement
    const disclosure = srcRow.querySelector('.dsh-fe-disclosure') as HTMLElement

    // First expand
    act(() => {
      disclosure.click()
    })
    await flush()
    expect(fetchList).toHaveBeenCalledTimes(2) // root + src

    // Collapse
    act(() => {
      disclosure.click()
    })
    await flush()

    // Expand again — should NOT call fetchList again
    act(() => {
      disclosure.click()
    })
    await flush()

    expect(fetchList).toHaveBeenCalledTimes(2) // still only root + src
  })

  test('renders empty state when sessionId is undefined', () => {
    const fetchList = vi.fn().mockResolvedValue([])
    const onSelectFile = vi.fn()

    const container = render(
      <FileTree sessionId={undefined} fetchList={fetchList} onSelectFile={onSelectFile} />,
    )

    // Should not have called fetchList
    expect(fetchList).not.toHaveBeenCalled()

    // Should show empty state message
    expect(container.textContent).toContain('当前没有打开的会话')
  })

  test('refresh button re-fetches root and clears cached children', async () => {
    const fetchList = vi
      .fn()
      .mockResolvedValueOnce(rootEntries) // initial root
      .mockResolvedValueOnce(srcChildren) // first expand src
      .mockResolvedValueOnce(rootEntries) // refresh root

    const onSelectFile = vi.fn()

    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} onSelectFile={onSelectFile} />,
    )
    await flush()

    // Expand src to cache children
    const rows = container.querySelectorAll('.dsh-fe-tree-row')
    const srcRow = Array.from(rows).find((r) =>
      r.textContent!.includes('src'),
    ) as HTMLElement
    const disclosure = srcRow.querySelector('.dsh-fe-disclosure') as HTMLElement
    act(() => {
      disclosure.click()
    })
    await flush()
    expect(fetchList).toHaveBeenCalledTimes(2) // root + src

    // Click refresh
    const refreshBtn = container.querySelector('.dsh-fe-refresh') as HTMLElement
    expect(refreshBtn).toBeTruthy()

    act(() => {
      refreshBtn.click()
    })

    // Should have called fetchList for root again
    expect(fetchList).toHaveBeenCalledTimes(3)
    expect(fetchList).toHaveBeenCalledWith('s1', '')

    await flush()

    // After refresh, children cache should be cleared — only root rows
    const rowsAfterRefresh = container.querySelectorAll('.dsh-fe-tree-row')
    expect(rowsAfterRefresh.length).toBe(3) // just root entries again
  })

  test('refetches root when sessionId changes', async () => {
    const fetchList = vi
      .fn()
      .mockResolvedValueOnce(rootEntries) // s1 root
      .mockResolvedValueOnce([]) // s2 root (empty)

    const onSelectFile = vi.fn()

    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} onSelectFile={onSelectFile} />,
    )
    await flush()
    expect(fetchList).toHaveBeenCalledWith('s1', '')

    // Re-render with new sessionId
    const root = createRoot(container.firstChild as HTMLElement)
    act(() => {
      root.render(
        <FileTree sessionId="s2" fetchList={fetchList} onSelectFile={onSelectFile} />,
      )
    })
    await flush()

    expect(fetchList).toHaveBeenCalledWith('s2', '')
    expect(fetchList).toHaveBeenCalledTimes(2)
  })
})