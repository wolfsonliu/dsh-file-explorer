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
    copyAbsolutePath: vi.fn().mockResolvedValue(undefined),
    copyRelativePath: vi.fn().mockResolvedValue(undefined),
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

  test('clicking the ellipsis button opens a menu with 3 items for a file row', async () => {
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
    expect(items.length).toBe(3)
    expect(items[0].textContent).toContain('open')
    expect(items[1].textContent).toContain('copyAbsolutePath')
    expect(items[2].textContent).toContain('copyRelativePath')
  })

  test('clicking the ellipsis button opens a menu with 2 items for a directory row', async () => {
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
    expect(items.length).toBe(2)
    expect(items[0].textContent).toContain('copyAbsolutePath')
    expect(items[1].textContent).toContain('copyRelativePath')
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
})
