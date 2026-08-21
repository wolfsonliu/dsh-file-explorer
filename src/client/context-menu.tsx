import React, { useEffect, useRef, type ReactNode } from 'react'

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
  /** Menu anchor position (viewport coordinates). */
  anchor: { x: number; y: number }
  /** The menu items, in render order. */
  items: Array<FileContextMenuItem>
  onClose: () => void
}

/** A generic anchored popup menu listing arbitrary items. */
export function FileContextMenu({ open, anchor, items, onClose }: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside pointerdown.
  useEffect(() => {
    if (!open) return

    const handlePointerDown = (e: PointerEvent) => {
      // If the click is inside the menu, do nothing.
      if (menuRef.current && menuRef.current.contains(e.target as Node)) {
        return
      }
      onClose()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={menuRef}
      className="dsh-fe-menu"
      role="menu"
      style={{
        position: 'fixed',
        left: `${anchor.x}px`,
        top: `${anchor.y}px`,
      }}
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={'dsh-fe-menu-item' + (item.danger ? ' dsh-fe-menu-item--danger' : '')}
          role="menuitem"
          onClick={() => {
            item.onSelect()
            onClose()
          }}
        >
          {item.icon}
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}
