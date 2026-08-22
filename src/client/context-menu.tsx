import React, { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface FileContextMenuItem {
  /** Stable identity for the item (also used as the React key). */
  id: string
  /** Display label (already localized). */
  label: string
  /** Optional leading icon. */
  icon?: ReactNode
  /** Render this item with the danger color. */
  danger?: boolean
  /** Called when the item is selected (before the menu closes). */
  onSelect: () => void
}

export interface FileContextMenuProps {
  /** Whether the menu is shown. */
  open: boolean
  /**
   * Anchor trigger rect supplier, re-read on scroll/resize while open.
   * Return null to skip placement for that frame (keeps the last position).
   */
  getAnchorRect: () => DOMRect | null
  /** The menu items, in render order. */
  items: Array<FileContextMenuItem>
  onClose: () => void
}

/** Clearance between the menu card and the viewport edges (dsh web MARGIN). */
const MARGIN = 12

/** Unplaced (measuring) frame: hidden but laid out so offsetWidth/Height are real. */
const MEASURE_STYLE: CSSProperties = { visibility: 'hidden', left: 0, top: 0 }

/**
 * A generic anchored popup menu listing arbitrary items.
 *
 * Renders into document.body via a portal and fixed-positions itself from the
 * anchor rect, clamped to a 12px viewport margin, re-placing on scroll/resize.
 * Closes on outside pointerdown or Escape.
 */
export function FileContextMenu({ open, getAnchorRect, items, onClose }: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [fixedPos, setFixedPos] = useState<CSSProperties | null>(null)
  const anchorRectRef = useRef(getAnchorRect)
  anchorRectRef.current = getAnchorRect

  useLayoutEffect(() => {
    if (!open) {
      setFixedPos(null)
      return
    }

    const place = () => {
      const rect = anchorRectRef.current()
      if (rect === null) return
      const el = menuRef.current
      const lw = el?.offsetWidth ?? 0
      const lh = el?.offsetHeight ?? 0
      const vw = window.innerWidth
      const vh = window.innerHeight

      let x = rect.left
      let y = rect.bottom + 4
      if (lw > 0) x = Math.min(Math.max(x, MARGIN), vw - lw - MARGIN)
      if (lh > 0) y = Math.min(Math.max(y, MARGIN), vh - lh - MARGIN)
      setFixedPos({ left: x, top: y })
    }

    // First run measures the hidden pre-render in the same commit, so the first
    // painted frame is already at the final clamped position.
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  // Close on outside pointerdown or Escape.
  useEffect(() => {
    if (!open) return

    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return
      onClose()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  const menu = (
    <div
      ref={menuRef}
      className="dsh-fe-menu"
      data-fe-menu
      role="menu"
      style={{ position: 'fixed', ...(fixedPos ?? MEASURE_STYLE) }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={'dsh-fe-menu-item' + (item.danger ? ' dsh-fe-menu-item--danger' : '')}
          data-fe-menu-item={item.id}
          role="menuitem"
          onClick={() => {
            item.onSelect()
            onClose()
          }}
        >
          {item.icon !== undefined && <span className="dsh-fe-menu-item-icon">{item.icon}</span>}
          <span className="dsh-fe-menu-item-label">{item.label}</span>
        </button>
      ))}
    </div>
  )

  return createPortal(menu, document.body)
}