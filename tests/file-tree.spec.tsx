// @vitest-environment jsdom
import { describe, expect, test, vi, beforeAll } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import React from 'react'
import { FileTree, type FileTreeHandle } from '../src/client/file-tree.tsx'
import { registerBuiltinFileActions } from '../src/client/file-action.ts'
import type { FileActionHelpers } from '../src/client/file-action.ts'
import type { BrowserEntry } from '../src/protocol.ts'

/** Identity translator: renders the localization key as-is. */
const t = (key: string) => key

// The built-in action registry is module-level and not idempotent, so register
// exactly once for this whole spec file.
beforeAll(() => {
  registerBuiltinFileActions()
})

/** File-action helpers with spy implementations. */
function makeHelpers(): FileActionHelpers {
  return {
    openFile: vi.fn(),
    openFileAsText: vi.fn(),
    openFileAsBinary: vi.fn(),
    copyAbsolutePath: vi.fn().mockResolvedValue(undefined),
    copyRelativePath: vi.fn().mockResolvedValue(undefined),
    promptRename: vi.fn(),
    promptDelete: vi.fn(),
    promptMove: vi.fn(),
    promptCopy: vi.fn(),
    promptNewFile: vi.fn(),
    promptNewFolder: vi.fn(),
  }
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

/** Flush all pending microtasks so async state updates settle. */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, 0))
  })
}

/** Find the row whose text content includes the given name. */
function rowNamed(container: HTMLElement, name: string): HTMLElement {
  const row = Array.from(container.querySelectorAll('.dsh-fe-tree-row')).find((r) =>
    r.textContent!.includes(name),
  ) as HTMLElement
  expect(row).toBeTruthy()
  return row
}

/** The trailing ellipsis action button on a row. */
function actionButton(row: HTMLElement): HTMLElement {
  const btn = row.querySelector('[data-fe-action-button]') as HTMLElement
  expect(btn).toBeTruthy()
  return btn
}

/** Set the search input's value and fire React's onChange. */
function setSearch(container: HTMLElement, value: string): void {
  const input = container.querySelector('[data-fe-search]') as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

/** Set the sort `<select>` value and fire React's onChange. */
function setSort(container: HTMLElement, value: string): void {
  const select = container.querySelector('[data-fe-sort]') as HTMLSelectElement
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!
  act(() => {
    setter.call(select, value)
    select.dispatchEvent(new Event('change', { bubbles: true }))
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
    const helpers = makeHelpers()

    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
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

  test('sort select reorders rows by size descending', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const helpers = makeHelpers()
    const container = render(<FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />)
    await flush()

    let names = Array.from(container.querySelectorAll('.dsh-fe-name')).map(n => n.textContent)
    expect(names).toEqual(['src', 'README.md', 'package.json'])

    setSort(container, 'size-desc')
    names = Array.from(container.querySelectorAll('.dsh-fe-name')).map(n => n.textContent)
    expect(names).toEqual(['src', 'package.json', 'README.md'])
  })

  test('clicking a file row calls helpers.openFile with the file path', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const helpers = makeHelpers()

    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    const readmeRow = rowNamed(container, 'README.md')

    act(() => {
      readmeRow.click()
    })

    expect(helpers.openFile).toHaveBeenCalledWith('README.md')
  })

  test('clicking a directory row first time fetches children and reveals them', async () => {
    const fetchList = vi
      .fn()
      .mockResolvedValueOnce(rootEntries) // root
      .mockResolvedValueOnce(srcChildren) // src children

    const helpers = makeHelpers()

    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    const srcRow = rowNamed(container, 'src')

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

    const helpers = makeHelpers()

    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    const srcRow = rowNamed(container, 'src')
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
    const helpers = makeHelpers()

    const container = render(
      <FileTree sessionId={undefined} fetchList={fetchList} helpers={helpers} t={t} />,
    )

    // Should not have called fetchList
    expect(fetchList).not.toHaveBeenCalled()

    // Should show empty state message
    expect(container.textContent).toContain('noSession')
  })

  test('does not render a toolbar or internal refresh button', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const helpers = makeHelpers()

    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    expect(container.querySelector('.dsh-fe-tree-toolbar')).toBeNull()
    expect(container.querySelector('[data-fe-action="refresh"]')).toBeNull()
  })

  test('ref.current.refresh() re-fetches root and clears cached children', async () => {
    const fetchList = vi
      .fn()
      .mockResolvedValueOnce(rootEntries) // initial root
      .mockResolvedValueOnce(srcChildren) // first expand src
      .mockResolvedValueOnce(rootEntries) // refresh root

    const helpers = makeHelpers()
    const ref = React.createRef<FileTreeHandle>()

    const container = render(
      <FileTree ref={ref} sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    // Expand src to cache children
    const srcRow = rowNamed(container, 'src')
    const disclosure = srcRow.querySelector('.dsh-fe-disclosure') as HTMLElement
    act(() => {
      disclosure.click()
    })
    await flush()
    expect(fetchList).toHaveBeenCalledTimes(2) // root + src

    // Call refresh via the imperative handle
    expect(ref.current).toBeTruthy()
    act(() => {
      ref.current!.refresh()
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

    const helpers = makeHelpers()

    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()
    expect(fetchList).toHaveBeenCalledWith('s1', '')

    // Re-render with new sessionId
    const root = createRoot(container.firstChild as HTMLElement)
    act(() => {
      root.render(
        <FileTree sessionId="s2" fetchList={fetchList} helpers={helpers} t={t} />,
      )
    })
    await flush()

    expect(fetchList).toHaveBeenCalledWith('s2', '')
    expect(fetchList).toHaveBeenCalledTimes(2)
  })

  // -------------------------------------------------------------------------
  // Ellipsis action button + menu
  // -------------------------------------------------------------------------
  test('each row renders an ellipsis action button', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const helpers = makeHelpers()

    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    const rows = container.querySelectorAll('.dsh-fe-tree-row')
    expect(rows.length).toBe(3)
    for (const row of Array.from(rows)) {
      expect(row.querySelector('[data-fe-action-button]')).not.toBeNull()
    }
  })

  test('clicking the ellipsis button opens a menu with 9 items for a file row', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const helpers = makeHelpers()

    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    const readmeRow = rowNamed(container, 'README.md')
    act(() => {
      actionButton(readmeRow).click()
    })

    const menu = container.querySelector('[role="menu"]')
    expect(menu).not.toBeNull()

    const items = menu!.querySelectorAll('[role="menuitem"]')
    expect(items.length).toBe(9)
    expect(items[0].textContent).toContain('open')
    expect(items[1].textContent).toContain('openAsText')
    expect(items[2].textContent).toContain('openAsBinary')
    expect(items[3].textContent).toContain('copyAbsolutePath')
    expect(items[4].textContent).toContain('copyRelativePath')
    expect(items[5].textContent).toContain('rename')
    expect(items[6].textContent).toContain('moveTo')
    expect(items[7].textContent).toContain('copyTo')
    expect(items[8].textContent).toContain('delete')
  })

  test('clicking the ellipsis button opens a menu with 8 items for a directory row', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const helpers = makeHelpers()

    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    const srcRow = rowNamed(container, 'src')
    act(() => {
      actionButton(srcRow).click()
    })

    const menu = container.querySelector('[role="menu"]')
    expect(menu).not.toBeNull()

    const items = menu!.querySelectorAll('[role="menuitem"]')
    expect(items.length).toBe(8)
    expect(items[0].textContent).toContain('copyAbsolutePath')
    expect(items[1].textContent).toContain('copyRelativePath')
    expect(items[2].textContent).toContain('rename')
    expect(items[3].textContent).toContain('moveTo')
    expect(items[4].textContent).toContain('copyTo')
    expect(items[5].textContent).toContain('delete')
    expect(items[6].textContent).toContain('newFile')
    expect(items[7].textContent).toContain('newFolder')
  })

  test('clicking the open menu item calls helpers.openFile', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const helpers = makeHelpers()

    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    const readmeRow = rowNamed(container, 'README.md')
    act(() => {
      actionButton(readmeRow).click()
    })

    const menu = container.querySelector('[role="menu"]') as HTMLElement
    const openItem = Array.from(menu.querySelectorAll('[role="menuitem"]')).find((el) =>
      el.textContent!.includes('open'),
    ) as HTMLElement
    expect(openItem).toBeTruthy()

    act(() => {
      openItem.click()
    })

    expect(helpers.openFile).toHaveBeenCalledWith('README.md')
  })

  test('clicking the copy-absolute menu item calls helpers.copyAbsolutePath', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const helpers = makeHelpers()

    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    const readmeRow = rowNamed(container, 'README.md')
    act(() => {
      actionButton(readmeRow).click()
    })

    const menu = container.querySelector('[role="menu"]') as HTMLElement
    const copyItem = Array.from(menu.querySelectorAll('[role="menuitem"]')).find((el) =>
      el.textContent!.includes('copyAbsolutePath'),
    ) as HTMLElement
    expect(copyItem).toBeTruthy()

    act(() => {
      copyItem.click()
    })

    expect(helpers.copyAbsolutePath).toHaveBeenCalledWith('README.md')
  })

  test('clicking the copy-relative menu item calls helpers.copyRelativePath', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const helpers = makeHelpers()

    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    const readmeRow = rowNamed(container, 'README.md')
    act(() => {
      actionButton(readmeRow).click()
    })

    const menu = container.querySelector('[role="menu"]') as HTMLElement
    const copyItem = Array.from(menu.querySelectorAll('[role="menuitem"]')).find((el) =>
      el.textContent!.includes('copyRelativePath'),
    ) as HTMLElement
    expect(copyItem).toBeTruthy()

    act(() => {
      copyItem.click()
    })

    expect(helpers.copyRelativePath).toHaveBeenCalledWith('README.md')
  })

  test('right-clicking a row no longer opens a menu', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const helpers = makeHelpers()

    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    const readmeRow = rowNamed(container, 'README.md')
    act(() => {
      readmeRow.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 150,
          clientY: 250,
        }),
      )
    })

    expect(container.querySelector('[role="menu"]')).toBeNull()
  })

  // -------------------------------------------------------------------------
  // SVG icons — no emoji/glyph text
  // -------------------------------------------------------------------------
  test('directory rows render an SVG icon (not the 📁 emoji)', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const helpers = makeHelpers()

    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    const srcRow = rowNamed(container, 'src')
    const icon = srcRow.querySelector('.dsh-fe-icon') as HTMLElement

    expect(icon).toBeTruthy()
    expect(icon.querySelector('svg')).toBeTruthy()
    expect(icon.textContent).not.toContain('📁')
  })

  test('file rows render an SVG icon (not the 📄 emoji)', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const helpers = makeHelpers()

    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    const readmeRow = rowNamed(container, 'README.md')
    const icon = readmeRow.querySelector('.dsh-fe-icon') as HTMLElement

    expect(icon).toBeTruthy()
    expect(icon.querySelector('svg')).toBeTruthy()
    expect(icon.textContent).not.toContain('📄')
  })

  test('directory rows render an SVG chevron in the disclosure span (not ▸/▾)', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const helpers = makeHelpers()

    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    const srcRow = rowNamed(container, 'src')
    const disclosure = srcRow.querySelector('.dsh-fe-disclosure') as HTMLElement

    expect(disclosure).toBeTruthy()
    expect(disclosure.querySelector('svg')).toBeTruthy()
    expect(disclosure.textContent).not.toContain('▸')
    expect(disclosure.textContent).not.toContain('▾')
  })

  test('expanding a directory swaps the folder icon and rotates the chevron', async () => {
    const fetchList = vi
      .fn()
      .mockResolvedValueOnce(rootEntries) // root
      .mockResolvedValueOnce(srcChildren) // src children

    const helpers = makeHelpers()

    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    const srcRow = rowNamed(container, 'src')
    const icon = srcRow.querySelector('.dsh-fe-icon') as HTMLElement
    const disclosure = srcRow.querySelector('.dsh-fe-disclosure') as HTMLElement

    const iconData = (el: HTMLElement) =>
      Array.from(el.querySelectorAll('path'))
        .map((p) => p.getAttribute('d') ?? '')
        .join('')

    const closedData = iconData(icon)
    const chevron = disclosure.querySelector('svg') as SVGElement
    expect(chevron.style.transform).toBe('')

    act(() => {
      disclosure.click()
    })
    await flush()

    expect(iconData(icon)).not.toBe(closedData)
    expect((disclosure.querySelector('svg') as SVGElement).style.transform).toBe('rotate(90deg)')
  })

  test('no row textContent contains the 📁/📄 emoji glyphs', async () => {
    const fetchList = vi
      .fn()
      .mockResolvedValueOnce(rootEntries) // root
      .mockResolvedValueOnce(srcChildren) // src children

    const helpers = makeHelpers()

    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    // Expand "src" so child rows (another dir + a file) are also covered.
    const srcRow = rowNamed(container, 'src')
    const disclosure = srcRow.querySelector('.dsh-fe-disclosure') as HTMLElement
    act(() => {
      disclosure.click()
    })
    await flush()

    const rows = container.querySelectorAll('.dsh-fe-tree-row')
    expect(rows.length).toBe(5)
    for (const row of Array.from(rows)) {
      expect(row.textContent).not.toContain('📁')
      expect(row.textContent).not.toContain('📄')
    }
  })

  test('polls loaded directories while autoRefresh is true', async () => {
    vi.useFakeTimers()
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const helpers = makeHelpers()
    render(<FileTree sessionId="s1" autoRefresh fetchList={fetchList} helpers={helpers} t={t} />)
    await act(async () => {})
    expect(fetchList).toHaveBeenCalledTimes(1)

    act(() => { vi.advanceTimersByTime(3000) })
    await act(async () => {})
    expect(fetchList).toHaveBeenCalledTimes(2)
    expect(fetchList).toHaveBeenLastCalledWith('s1', '')

    vi.useRealTimers()
  })

  test('does not poll when autoRefresh is false', async () => {
    vi.useFakeTimers()
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const helpers = makeHelpers()
    render(<FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />)
    await act(async () => {})
    expect(fetchList).toHaveBeenCalledTimes(1)

    act(() => { vi.advanceTimersByTime(10000) })
    await act(async () => {})
    expect(fetchList).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  test('refreshes loaded directories on window focus', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const helpers = makeHelpers()
    render(<FileTree sessionId="s1" autoRefresh fetchList={fetchList} helpers={helpers} t={t} />)
    await flush()
    expect(fetchList).toHaveBeenCalledTimes(1)

    act(() => { window.dispatchEvent(new Event('focus')) })
    await flush()
    expect(fetchList).toHaveBeenCalledTimes(2)
  })

  test('auto-refresh preserves expanded directories', async () => {
    const fetchList = vi.fn()
      .mockResolvedValueOnce(rootEntries)   // initial root
      .mockResolvedValueOnce(srcChildren)   // expand src
      .mockResolvedValueOnce(rootEntries)   // focus: root
      .mockResolvedValueOnce(srcChildren)   // focus: src
    const helpers = makeHelpers()
    const container = render(
      <FileTree sessionId="s1" autoRefresh fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    const srcRow = rowNamed(container, 'src')
    const disclosure = srcRow.querySelector('.dsh-fe-disclosure') as HTMLElement
    act(() => { disclosure.click() })
    await flush()
    expect(container.querySelectorAll('.dsh-fe-tree-row').length).toBe(5)

    act(() => { window.dispatchEvent(new Event('focus')) })
    await flush()

    expect(container.querySelectorAll('.dsh-fe-tree-row').length).toBe(5)
    expect(fetchList).toHaveBeenCalledTimes(4)
  })

  // -------------------------------------------------------------------------
  // Search box + client-side filtering
  // -------------------------------------------------------------------------
  test('renders a search box above the tree', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const helpers = makeHelpers()
    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    const input = container.querySelector('[data-fe-search]') as HTMLInputElement
    expect(input).toBeTruthy()
    expect(input.getAttribute('placeholder')).toBe('searchPlaceholder')
    expect(container.querySelectorAll('.dsh-fe-tree-row').length).toBe(3)
  })

  test('typing filters the tree by name, case-insensitively', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const helpers = makeHelpers()
    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    setSearch(container, 'README')
    await flush()

    const results = container.querySelectorAll('.dsh-fe-search-result')
    expect(results.length).toBe(1)
    expect(results[0].textContent).toContain('README.md')
    // The normal tree is hidden while searching.
    expect(container.querySelectorAll('.dsh-fe-tree-row').length).toBe(0)
  })

  test('search matches already-expanded directory children by path', async () => {
    const fetchList = vi
      .fn()
      .mockResolvedValueOnce(rootEntries)
      .mockResolvedValueOnce(srcChildren)
    const helpers = makeHelpers()
    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    const srcRow = rowNamed(container, 'src')
    act(() => { (srcRow.querySelector('.dsh-fe-disclosure') as HTMLElement).click() })
    await flush()

    setSearch(container, 'index')
    await flush()

    const results = container.querySelectorAll('.dsh-fe-search-result')
    expect(results.length).toBe(1)
    expect(results[0].textContent).toContain('index.ts')
    expect(results[0].textContent).toContain('src') // path hint
  })

  test('empty query restores the full tree', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const helpers = makeHelpers()
    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    setSearch(container, 'package')
    await flush()
    expect(container.querySelectorAll('.dsh-fe-tree-row').length).toBe(0)

    setSearch(container, '')
    await flush()
    expect(container.querySelectorAll('.dsh-fe-tree-row').length).toBe(3)
  })

  test('no matches renders the empty state', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const helpers = makeHelpers()
    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    setSearch(container, 'zzzzz')
    await flush()

    expect(container.querySelector('[data-fe-search-empty]')).toBeTruthy()
    expect(container.textContent).toContain('noSearchResults')
  })

  test('clear button clears the query and restores the tree', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const helpers = makeHelpers()
    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    setSearch(container, 'readme')
    await flush()
    const clear = container.querySelector('[data-fe-search-clear]') as HTMLElement
    expect(clear).toBeTruthy()

    act(() => { clear.click() })
    await flush()

    expect(container.querySelectorAll('.dsh-fe-tree-row').length).toBe(3)
  })

  test('clicking a search result file opens it and clears the search', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const helpers = makeHelpers()
    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    setSearch(container, 'package')
    await flush()

    const result = container.querySelector('.dsh-fe-search-result') as HTMLElement
    act(() => { result.click() })

    expect(helpers.openFile).toHaveBeenCalledWith('package.json')
    // Search cleared: tree restored.
    expect(container.querySelectorAll('.dsh-fe-tree-row').length).toBe(3)
  })

  test('whitespace-only query does not enter search mode', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const helpers = makeHelpers()
    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    setSearch(container, '   ')
    await flush()

    expect(container.querySelectorAll('.dsh-fe-tree-row').length).toBe(3)
    expect(container.querySelector('[data-fe-search-empty]')).toBeNull()
  })

  test('clicking a directory search result restores the tree without opening a file', async () => {
    const fetchList = vi.fn().mockResolvedValue(rootEntries)
    const helpers = makeHelpers()
    const container = render(
      <FileTree sessionId="s1" fetchList={fetchList} helpers={helpers} t={t} />,
    )
    await flush()

    // 'sr' matches only the 'src' directory at the root.
    setSearch(container, 'sr')
    await flush()

    const result = container.querySelector('.dsh-fe-search-result--dir') as HTMLElement
    expect(result).toBeTruthy()

    act(() => { result.click() })

    expect(helpers.openFile).not.toHaveBeenCalled()
    // Query cleared → full tree restored, 'src' directory still present.
    expect(container.querySelectorAll('.dsh-fe-tree-row').length).toBe(3)
    expect(container.textContent).toContain('src')
  })
})
