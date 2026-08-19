import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import type { BrowserEntry } from '../protocol.ts'
import type { Translate } from './locale.ts'
import { VirtualList } from './virtual-list.tsx'
import { FileContextMenu } from './context-menu.tsx'
import { fileActionsFor, type FileActionHelpers } from './file-action.ts'
import { IconChevronRight, IconEllipsis, IconFile, IconFolderClose, IconFolderOpen } from './icons.tsx'

export interface FileTreeProps {
  /** Current session id; undefined means "no session". */
  sessionId: string | undefined
  /** Action helpers used by the per-row action menu. */
  helpers: FileActionHelpers
  /** List one directory level (injectable for tests). Returns workspace-relative entries. */
  fetchList: (sessionId: string, path: string) => Promise<BrowserEntry[]>
  /** Translator for localized UI copy. */
  t: Translate
  /** When true, periodically refresh loaded directories (while visible). */
  autoRefresh?: boolean
}

/** Imperative handle exposed by FileTree. */
export interface FileTreeHandle {
  /** Re-fetch the root and clear cached children. */
  refresh(): void
}

/** Stable sort: directories before files, then code-point order by name. */
function sortEntries(entries: BrowserEntry[]): BrowserEntry[] {
  return [...entries].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  })
}

/** Per-row action-menu state. */
interface MenuState {
  open: boolean
  anchor: { x: number; y: number }
  entry: BrowserEntry | null
}

export const FileTree = forwardRef<FileTreeHandle, FileTreeProps>(function FileTree(
  { sessionId, helpers, fetchList, t, autoRefresh },
  ref,
) {
  const [entries, setEntries] = useState<BrowserEntry[]>([])
  const [children, setChildren] = useState<Record<string, BrowserEntry[]>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [menu, setMenu] = useState<MenuState>({ open: false, anchor: { x: 0, y: 0 }, entry: null })

  const childrenRef = useRef(children)
  childrenRef.current = children
  const refreshingRef = useRef(false)

  const refreshLoadedDirectories = useCallback(() => {
    if (!sessionId || refreshingRef.current) return
    refreshingRef.current = true
    const reload = (path: string, isRoot: boolean) => {
      fetchList(sessionId, path)
        .then((list) => {
          if (!mountedRef.current) return
          const sorted = sortEntries(list)
          if (isRoot) setEntries(sorted)
          else setChildren((prev) => ({ ...prev, [path]: sorted }))
        })
        .catch(() => {
          // Ignore polling fetch failures.
        })
    }
    const targets: Array<[string, boolean]> = [
      ['', true],
      ...Object.keys(childrenRef.current).map((p) => [p, false] as [string, boolean]),
    ]
    void Promise.all(targets.map(([path, isRoot]) => reload(path, isRoot))).finally(() => {
      refreshingRef.current = false
    })
  }, [sessionId, fetchList])

  // Track mounted state to avoid setState after unmount
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Fetch root on mount / sessionId change / refresh
  useEffect(() => {
    if (!sessionId) return

    let cancelled = false
    fetchList(sessionId, '').then((list) => {
      if (cancelled || !mountedRef.current) return
      setEntries(sortEntries(list))
    })

    return () => {
      cancelled = true
    }
  }, [sessionId, fetchList, refreshKey])

  // Reset children and expanded when sessionId changes or refresh
  useEffect(() => {
    setChildren({})
    setExpanded({})
  }, [sessionId, refreshKey])

  useEffect(() => {
    if (!autoRefresh || !sessionId) return
    const poll = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      refreshLoadedDirectories()
    }, 3000)
    const onFocus = () => {
      if (document.visibilityState !== 'visible') return
      refreshLoadedDirectories()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshLoadedDirectories()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(poll)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [autoRefresh, sessionId, refreshLoadedDirectories])

  const handleDisclosureClick = useCallback(
    (entry: BrowserEntry) => {
      const path = entry.path

      setExpanded((prev) => {
        const next = !prev[path]

        // If expanding and children not yet fetched, fetch them
        if (next && !children[path]) {
          if (sessionId) {
            fetchList(sessionId, path).then((list) => {
              if (!mountedRef.current) return
              setChildren((prev) => ({ ...prev, [path]: sortEntries(list) }))
            })
          }
        }

        return { ...prev, [path]: next }
      })
    },
    [children, fetchList, sessionId],
  )

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const openMenu = useCallback((entry: BrowserEntry, anchor: { x: number; y: number }) => {
    setMenu({ open: true, anchor, entry })
  }, [])

  const closeMenu = useCallback(() => {
    setMenu((prev) => ({ ...prev, open: false }))
  }, [])

  useImperativeHandle(ref, () => ({ refresh: handleRefresh }), [handleRefresh])

  // Empty state
  if (!sessionId) {
    return (
      <div className="dsh-fe-tree-empty">
        <span className="dsh-fe-empty-text">{t('noSession')}</span>
      </div>
    )
  }

  const menuEntry = menu.entry
  const menuItems = menuEntry
    ? fileActionsFor(menuEntry.kind).map((a) => ({
        id: a.id,
        label: a.label(t),
        icon: a.icon,
        onSelect: () => a.onSelect(menuEntry, helpers),
      }))
    : []

  const flat = flattenVisible(entries, expanded, children)

  return (
    <div className="dsh-fe-tree">
      <VirtualList
        rowCount={flat.length}
        rowHeight={TREE_ROW_HEIGHT}
        rowKey={(i) => flat[i].path}
        renderRow={(i) => (
          <TreeRow
            entry={flat[i].entry}
            depth={flat[i].depth}
            expanded={expanded}
            onDisclosureClick={handleDisclosureClick}
            helpers={helpers}
            onOpenMenu={openMenu}
          />
        )}
      />
      <FileContextMenu
        open={menu.open}
        anchor={menu.anchor}
        items={menuItems}
        onClose={closeMenu}
      />
    </div>
  )
})

const TREE_ROW_HEIGHT = 28

interface FlatRow {
  path: string
  depth: number
  entry: BrowserEntry
}

/** DFS pre-order of every visible row, derived from the expanded set. */
function flattenVisible(
  entries: BrowserEntry[],
  expanded: Record<string, boolean>,
  childrenMap: Record<string, BrowserEntry[]>,
  depth = 0,
): FlatRow[] {
  const out: FlatRow[] = []
  for (const entry of entries) {
    out.push({ path: entry.path, depth, entry })
    if (entry.kind === 'directory' && expanded[entry.path] && childrenMap[entry.path]) {
      out.push(...flattenVisible(childrenMap[entry.path], expanded, childrenMap, depth + 1))
    }
  }
  return out
}

interface TreeRowProps {
  entry: BrowserEntry
  depth: number
  expanded: Record<string, boolean>
  onDisclosureClick: (entry: BrowserEntry) => void
  helpers: FileActionHelpers
  onOpenMenu: (entry: BrowserEntry, anchor: { x: number; y: number }) => void
}

function TreeRow({ entry, depth, expanded, onDisclosureClick, helpers, onOpenMenu }: TreeRowProps) {
  const isDir = entry.kind === 'directory'
  return (
    <div
      className={'dsh-fe-tree-row' + (isDir ? ' dsh-fe-tree-row--dir' : ' dsh-fe-tree-row--file')}
      data-fe-path={entry.path}
      data-fe-kind={entry.kind}
      style={{ paddingLeft: `${depth * 16 + 4}px` }}
      onClick={() => {
        if (!isDir) helpers.openFile(entry.path)
      }}
    >
      {isDir ? (
        <span
          className="dsh-fe-disclosure"
          onClick={(e) => {
            e.stopPropagation()
            onDisclosureClick(entry)
          }}
        >
          <IconChevronRight
            size={14}
            style={{ transform: expanded[entry.path] ? 'rotate(90deg)' : undefined, transition: 'transform 0.1s' }}
          />
        </span>
      ) : (
        <span className="dsh-fe-spacer" />
      )}
      <span className="dsh-fe-icon">
        {isDir ? (
          expanded[entry.path] ? <IconFolderOpen size={16} /> : <IconFolderClose size={16} />
        ) : (
          <IconFile size={16} />
        )}
      </span>
      <span className="dsh-fe-name">{entry.name}</span>
      <span className="dsh-fe-row-actions">
        <button
          type="button"
          className="dsh-fe-btn dsh-fe-row-action-btn"
          data-fe-action-button
          onClick={(e) => {
            e.stopPropagation()
            const rect = e.currentTarget.getBoundingClientRect()
            onOpenMenu(entry, { x: rect.left, y: rect.bottom })
          }}
        >
          <IconEllipsis size={16} />
        </button>
      </span>
    </div>
  )
}
