import { useEffect, useRef, useState } from 'react'
import type { BrowserEntry } from '../protocol.ts'
import type { Translate } from './locale.ts'
import { basenameOfRel, joinRel, type FileOp, type FileOps } from './file-ops.ts'
import { parentPathOf } from './tree-search.ts'
import { IconChevronRight, IconFolderClose } from './icons.tsx'

export interface FileOpsModalProps {
  op: FileOp
  fileOps: FileOps
  fetchList: (sessionId: string, path: string) => Promise<BrowserEntry[]>
  sessionId: string | undefined
  t: Translate
  /** Called after a successful operation with the resulting workspace-relative path. */
  onDone: (path: string) => void
  onCancel: () => void
}

function initialValue(op: FileOp): string {
  return op.kind === 'rename' ? op.entry.name : ''
}

function flattenDirs(
  dirMap: Record<string, BrowserEntry[]>,
  expanded: Record<string, boolean>,
  rootDirs: BrowserEntry[],
  path = '',
  depth = 0,
): Array<{ entry: BrowserEntry; depth: number }> {
  const out: Array<{ entry: BrowserEntry; depth: number }> = []
  for (const entry of rootDirs) {
    out.push({ entry, depth })
    if (expanded[entry.path] && dirMap[entry.path]) {
      out.push(...flattenDirs(dirMap, expanded, dirMap[entry.path], entry.path, depth + 1))
    }
  }
  return out
}

export function FileOpsModal({ op, fileOps, fetchList, sessionId, t, onDone, onCancel }: FileOpsModalProps) {
  const [value, setValue] = useState(() => initialValue(op))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [destDir, setDestDir] = useState('')
  const [dirMap, setDirMap] = useState<Record<string, BrowserEntry[]>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  // move/copy: enumerate root directories; default the destination to root.
  useEffect(() => {
    if (op.kind !== 'move' && op.kind !== 'copy') return
    if (sessionId === undefined) return
    let cancelled = false
    void fetchList(sessionId, '')
      .then(list => { if (!cancelled) setDirMap({ '': list.filter(e => e.kind === 'directory') }) })
      .catch(() => { /* Ignore destination-dir fetch failures. */ })
    return () => { cancelled = true }
  }, [op, sessionId, fetchList])

  const name = value.trim()
  const canSubmit = name !== '' && !saving

  const finishInput = async () => {
    if (op.kind !== 'rename' && op.kind !== 'new-file' && op.kind !== 'new-folder') return
    setSaving(true)
    setError(null)
    try {
      let resultPath: string
      if (op.kind === 'rename') {
        await fileOps.rename(op.entry.path, name)
        resultPath = joinRel(parentPathOf(op.entry.path), name)
      } else if (op.kind === 'new-file') {
        resultPath = joinRel(op.parentDir, name)
        await fileOps.createFile(resultPath)
      } else {
        resultPath = joinRel(op.parentDir, name)
        await fileOps.createDir(resultPath)
      }
      onDone(resultPath)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (op.kind !== 'delete') return
    setSaving(true)
    setError(null)
    try {
      await fileOps.remove(op.entry.path)
      onDone(op.entry.path)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  const confirmDest = async () => {
    if (op.kind !== 'move' && op.kind !== 'copy') return
    setSaving(true)
    setError(null)
    try {
      if (op.kind === 'move') await fileOps.move(op.entry.path, destDir)
      else await fileOps.copy(op.entry.path, destDir)
      onDone(joinRel(destDir, basenameOfRel(op.entry.path)))
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  const toggleDir = (path: string) => {
    const next = !expanded[path]
    if (next && !dirMap[path]) {
      if (sessionId !== undefined) {
        void fetchList(sessionId, path)
          .then(list => { if (mountedRef.current) setDirMap(m => ({ ...m, [path]: list.filter(e => e.kind === 'directory') })) })
          .catch(() => { /* Ignore destination-dir fetch failures. */ })
      }
    }
    setExpanded(prev => ({ ...prev, [path]: next }))
  }

  const isExcluded = (path: string) => {
    if (op.kind !== 'move' && op.kind !== 'copy') return false
    const src = op.entry.path
    return path === src || path.startsWith(`${src}/`)
  }

  const kind = op.kind
  const isInput = kind === 'rename' || kind === 'new-file' || kind === 'new-folder'
  const isDest = kind === 'move' || kind === 'copy'

  const submitLabel =
    kind === 'rename' ? t('confirm') :
    kind === 'delete' ? t('delete') :
    kind === 'move' ? t('moveHere') :
    kind === 'copy' ? t('copyHere') :
    t('create')

  const title =
    kind === 'rename' ? t('rename') :
    kind === 'delete' ? t('delete') :
    kind === 'move' ? t('moveTo') :
    kind === 'copy' ? t('copyTo') :
    kind === 'new-file' ? t('newFile') :
    t('newFolder')

  const rootDirs = dirMap[''] ?? []
  const flatDirs = flattenDirs(dirMap, expanded, rootDirs)

  const submit = isInput ? finishInput : kind === 'delete' ? confirmDelete : confirmDest
  const disabled = isInput ? !canSubmit : saving

  return (
    <div className="dsh-fe-op-overlay" onClick={() => { if (!saving) onCancel() }}>
      <div className="dsh-fe-op-modal" data-fe-op={kind} onClick={(e) => e.stopPropagation()}>
        <div className="dsh-fe-op-title">{title}</div>
        <div className="dsh-fe-op-body">
          {isInput && (
            <input
              className="dsh-fe-op-input"
              data-fe-op-input
              value={value}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); if (canSubmit) void finishInput() }
                else if (e.key === 'Escape') { e.preventDefault(); onCancel() }
              }}
            />
          )}
          {kind === 'delete' && (
            <div className="dsh-fe-op-confirm">{t('confirmDelete', { name: op.entry.name })}</div>
          )}
          {isDest && (
            <div className="dsh-fe-op-dir">
              <div className="dsh-fe-op-dir-hint">{t('selectDestination')}</div>
              <div className="dsh-fe-op-dir-list">
                <DirRow
                  selected={destDir === ''}
                  depth={0}
                  path=""
                  name={t('workspaceRoot')}
                  onSelect={() => { if (!saving) setDestDir('') }}
                />
                {flatDirs.map(({ entry, depth }) => (
                  <DirRow
                    key={entry.path}
                    selected={destDir === entry.path}
                    depth={depth + 1}
                    path={entry.path}
                    name={entry.name}
                    disabled={isExcluded(entry.path)}
                    expanded={!!expanded[entry.path]}
                    onSelect={() => { if (!saving && !isExcluded(entry.path)) setDestDir(entry.path) }}
                    onToggle={() => toggleDir(entry.path)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        {error !== null && <div className="dsh-fe-op-error">{t('opFailed')}: {error}</div>}
        <div className="dsh-fe-op-actions">
          <button className="dsh-fe-op-btn" data-fe-op-cancel disabled={saving} onClick={onCancel}>{t('cancel')}</button>
          <button
            className={'dsh-fe-op-btn' + (kind === 'delete' ? ' dsh-fe-op-btn--danger' : '')}
            data-fe-op-submit
            disabled={disabled}
            onClick={() => { void submit() }}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function DirRow({ selected, disabled, depth, path, name, expanded, onSelect, onToggle }: {
  selected: boolean
  disabled?: boolean
  depth: number
  path: string
  name: string
  expanded?: boolean
  onSelect: () => void
  onToggle?: () => void
}) {
  return (
    <div
      className="dsh-fe-op-dir-row"
      data-fe-op-dir-row
      data-fe-path={path}
      data-selected={selected ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : 'false'}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={disabled ? undefined : onSelect}
    >
      {onToggle !== undefined ? (
        <span
          className="dsh-fe-disclosure"
          onClick={(e) => {
            e.stopPropagation()
            if (disabled) return
            onToggle()
          }}
        >
          <IconChevronRight size={14} style={{ transform: expanded ? 'rotate(90deg)' : undefined }} />
        </span>
      ) : (
        <span className="dsh-fe-spacer" />
      )}
      <span className="dsh-fe-icon"><IconFolderClose size={16} /></span>
      <span className="dsh-fe-name">{name}</span>
    </div>
  )
}
