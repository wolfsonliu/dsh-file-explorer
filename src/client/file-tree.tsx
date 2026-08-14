import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import type { BrowserEntry } from '../protocol.ts'
import type { Translate } from './locale.ts'
import { IconChevronRight, IconFile, IconFolderClose, IconFolderOpen } from './icons.tsx'

export interface FileTreeProps {
  /** Current session id; undefined means "no session". */
  sessionId: string | undefined
  /** Called when the user clicks a file row. */
  onSelectFile: (path: string) => void
  /** List one directory level (injectable for tests). Returns workspace-relative entries. */
  fetchList: (sessionId: string, path: string) => Promise<BrowserEntry[]>
  /** Called when the user right-clicks a file row. */
  onContextMenu?: (entry: BrowserEntry, x: number, y: number) => void
  /** Translator for localized UI copy. */
  t: Translate
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

export const FileTree = forwardRef<FileTreeHandle, FileTreeProps>(function FileTree(
  { sessionId, fetchList, onSelectFile, onContextMenu, t },
  ref,
) {
  const [entries, setEntries] = useState<BrowserEntry[]>([])
  const [children, setChildren] = useState<Record<string, BrowserEntry[]>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [refreshKey, setRefreshKey] = useState(0)

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

  useImperativeHandle(ref, () => ({ refresh: handleRefresh }), [handleRefresh])

  // Empty state
  if (!sessionId) {
    return (
      <div className="dsh-fe-tree-empty">
        <span className="dsh-fe-empty-text">{t('noSession')}</span>
      </div>
    )
  }

  return (
    <div className="dsh-fe-tree">
      <div className="dsh-fe-tree-body">
        <EntryList
          entries={entries}
          depth={0}
          expanded={expanded}
          childrenMap={children}
          onDisclosureClick={handleDisclosureClick}
          onSelectFile={onSelectFile}
          onContextMenu={onContextMenu}
        />
      </div>
    </div>
  )
})

interface EntryListProps {
  entries: BrowserEntry[]
  depth: number
  expanded: Record<string, boolean>
  childrenMap: Record<string, BrowserEntry[]>
  onDisclosureClick: (entry: BrowserEntry) => void
  onSelectFile: (path: string) => void
  onContextMenu?: (entry: BrowserEntry, x: number, y: number) => void
}

function EntryList({
  entries,
  depth,
  expanded,
  childrenMap,
  onDisclosureClick,
  onSelectFile,
  onContextMenu,
}: EntryListProps) {
  return (
    <>
      {entries.map((entry) => (
        <React.Fragment key={entry.path}>
          <div
            className={
              'dsh-fe-tree-row' +
              (entry.kind === 'directory' ? ' dsh-fe-tree-row--dir' : ' dsh-fe-tree-row--file')
            }
            data-fe-path={entry.path}
            data-fe-kind={entry.kind}
            style={{ paddingLeft: `${depth * 16 + 4}px` }}
            onClick={() => {
              if (entry.kind === 'file') {
                onSelectFile(entry.path)
              }
            }}
            onContextMenu={
              entry.kind === 'file' && onContextMenu
                ? (e) => {
                    e.preventDefault()
                    onContextMenu(entry, e.clientX, e.clientY)
                  }
                : undefined
            }
          >
            {entry.kind === 'directory' ? (
              <span
                className="dsh-fe-disclosure"
                onClick={(e) => {
                  e.stopPropagation()
                  onDisclosureClick(entry)
                }}
              >
                <IconChevronRight
                  size={14}
                  style={{
                    transform: expanded[entry.path] ? 'rotate(90deg)' : undefined,
                    transition: 'transform 0.1s',
                  }}
                />
              </span>
            ) : (
              <span className="dsh-fe-spacer" />
            )}
            <span className="dsh-fe-icon">
              {entry.kind === 'directory' ? (
                expanded[entry.path] ? (
                  <IconFolderOpen size={16} />
                ) : (
                  <IconFolderClose size={16} />
                )
              ) : (
                <IconFile size={16} />
              )}
            </span>
            <span className="dsh-fe-name">{entry.name}</span>
          </div>
          {entry.kind === 'directory' &&
            expanded[entry.path] &&
            childrenMap[entry.path] && (
              <EntryList
                entries={childrenMap[entry.path]}
                depth={depth + 1}
                expanded={expanded}
                childrenMap={childrenMap}
                onDisclosureClick={onDisclosureClick}
                onSelectFile={onSelectFile}
                onContextMenu={onContextMenu}
              />
            )}
        </React.Fragment>
      ))}
    </>
  )
}