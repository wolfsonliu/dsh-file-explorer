import React, { useRef, useState, type ReactNode } from 'react'
import { IconClose, IconPanelLeft, IconRefresh } from './icons.tsx'
import type { Translate } from './locale.ts'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

const DRAG_THRESHOLD = 4

// Drawer resize limits + localStorage persistence key.
const MIN_DRAWER_WIDTH = 200
const MAX_DRAWER_WIDTH = 600
const DRAWER_WIDTH_KEY = 'dsh.file-explorer.drawer-width'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileExplorerDrawerProps {
  open: boolean
  onClose: () => void
  /** Optional title text (defaults to the localized title). */
  title?: string
  /** Called when the refresh button is clicked; button hidden when omitted. */
  onRefresh?: () => void
  /** Translator for localized UI copy. */
  t: Translate
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
  t,
  children,
}: FileExplorerDrawerProps) {
  const [width, setWidth] = useState<number>(() => {
    try {
      const saved = Number.parseInt(localStorage.getItem(DRAWER_WIDTH_KEY) ?? '', 10)
      if (Number.isFinite(saved)) return clamp(saved, MIN_DRAWER_WIDTH, MAX_DRAWER_WIDTH)
    } catch {
      // localStorage unavailable (private mode) — fall through to default.
    }
    return 280
  })
  const widthRef = useRef(width)
  widthRef.current = width
  const startRef = useRef({ x: 0, width: 0 })
  const downRef = useRef(false)
  const movedRef = useRef(false)

  const onResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    downRef.current = true
    startRef.current = { x: e.clientX, width: widthRef.current }
    movedRef.current = false
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // jsdom / non-capturing environments.
    }
  }

  const onResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!downRef.current) return
    if (!movedRef.current && Math.abs(e.clientX - startRef.current.x) <= DRAG_THRESHOLD) return
    movedRef.current = true
    const next = clamp(
      startRef.current.width + (e.clientX - startRef.current.x),
      MIN_DRAWER_WIDTH,
      MAX_DRAWER_WIDTH,
    )
    widthRef.current = next
    setWidth(next)
  }

  const onResizePointerUp = () => {
    downRef.current = false
    if (!movedRef.current) return
    try {
      localStorage.setItem(DRAWER_WIDTH_KEY, String(widthRef.current))
    } catch {
      // ignore persistence failure.
    }
  }

  const onResizePointerCancel = () => {
    downRef.current = false
  }

  if (!open) {
    return null
  }

  return (
    <div className="dsh-fe-drawer" data-fe-drawer style={{ width }}>
      <div className="dsh-fe-drawer-title">
        <span className="dsh-fe-drawer-title-text">{title ?? t('title')}</span>
        {onRefresh && (
          <button
            className="dsh-fe-btn"
            data-fe-action="refresh"
            onClick={onRefresh}
            title={t('refresh')}
          >
            <IconRefresh size={16} />
          </button>
        )}
        <button
          className="dsh-fe-btn"
          data-fe-drawer-close
          onClick={onClose}
          title={t('close')}
        >
          <IconClose size={16} />
        </button>
      </div>
      <div className="dsh-fe-drawer-body">{children}</div>
      <div
        className="dsh-fe-drawer-resize"
        data-fe-resize
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerCancel}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// FloatingFileButton
// ---------------------------------------------------------------------------

const BUTTON_TOP_KEY = 'dsh.file-explorer.button-top'
const BUTTON_HEIGHT = 36

export function FloatingFileButton({ onClick, t }: { onClick: () => void; t: Translate }) {
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
      title={t('title')}
      style={{ top }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <IconPanelLeft size={16} />
      <span className="dsh-fe-file-button-label">{t('file')}</span>
    </button>
  )
}
