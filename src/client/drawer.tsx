import React, { useRef, useState, type ReactNode } from 'react'
import { IconClose, IconPanelLeft, IconRefresh } from './icons.tsx'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileExplorerDrawerProps {
  open: boolean
  onClose: () => void
  /** Optional title text (default '文件浏览器'). */
  title?: string
  /** Called when the refresh button is clicked; button hidden when omitted. */
  onRefresh?: () => void
  /** The file tree. */
  children: ReactNode
}

// ---------------------------------------------------------------------------
// FileExplorerDrawer
// ---------------------------------------------------------------------------

export function FileExplorerDrawer({
  open,
  onClose,
  title,
  onRefresh,
  children,
}: FileExplorerDrawerProps) {
  if (!open) {
    return null
  }

  return (
    <div className="dsh-fe-drawer" data-fe-drawer>
      <div className="dsh-fe-drawer-title">
        <span className="dsh-fe-drawer-title-text">{title ?? '文件浏览器'}</span>
        {onRefresh && (
          <button
            className="dsh-fe-btn"
            data-fe-action="refresh"
            onClick={onRefresh}
            title="刷新"
          >
            <IconRefresh size={16} />
          </button>
        )}
        <button
          className="dsh-fe-btn"
          data-fe-drawer-close
          onClick={onClose}
          title="关闭"
        >
          <IconClose size={16} />
        </button>
      </div>
      <div className="dsh-fe-drawer-body">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FloatingFileButton
// ---------------------------------------------------------------------------

const BUTTON_TOP_KEY = 'dsh.file-explorer.button-top'
const BUTTON_HEIGHT = 36
const DRAG_THRESHOLD = 4

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function FloatingFileButton({ onClick }: { onClick: () => void }) {
  const [top, setTop] = useState<number>(() => {
    try {
      const saved = Number.parseInt(localStorage.getItem(BUTTON_TOP_KEY) ?? '', 10)
      if (Number.isFinite(saved)) return saved
    } catch {
      // localStorage unavailable (private mode) — fall through to default.
    }
    return Math.round(window.innerHeight / 2) - Math.round(BUTTON_HEIGHT / 2)
  })
  const topRef = useRef(top)
  topRef.current = top
  const startRef = useRef({ y: 0, top: 0 })
  const downRef = useRef(false)
  const movedRef = useRef(false)

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    downRef.current = true
    startRef.current = { y: e.clientY, top: topRef.current }
    movedRef.current = false
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // jsdom / non-capturing environments.
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!downRef.current) return
    if (!movedRef.current && Math.abs(e.clientY - startRef.current.y) <= DRAG_THRESHOLD) return
    movedRef.current = true
    const maxTop = window.innerHeight - BUTTON_HEIGHT - 8
    setTop(clamp(startRef.current.top + (e.clientY - startRef.current.y), 8, maxTop))
  }

  const onPointerUp = () => {
    downRef.current = false
    if (!movedRef.current) return
    try {
      localStorage.setItem(BUTTON_TOP_KEY, String(topRef.current))
    } catch {
      // ignore persistence failure.
    }
  }

  const onPointerCancel = () => {
    downRef.current = false
  }

  const handleClick = () => {
    if (movedRef.current) return
    onClick()
  }

  return (
    <button
      className="dsh-fe-file-button"
      data-fe-file-button
      onClick={handleClick}
      title="文件浏览器（可上下拖动）"
      style={{ top }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <IconPanelLeft size={16} />
      <span className="dsh-fe-file-button-label">文件</span>
    </button>
  )
}
