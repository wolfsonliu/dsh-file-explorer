import React, { useCallback, useEffect, useRef } from 'react'
import type { Translate } from './locale.ts'

export interface FileContextMenuProps {
  /** Menu anchor position (viewport coordinates). */
  x: number
  y: number
  /** Whether the menu is shown. */
  open: boolean
  /** The file's full (workspace-relative) path. */
  path: string
  /** The file's path relative to the workspace root (for "copy relative path"). */
  relativePath: string
  /** Translator for localized menu item labels. */
  t: Translate
  onOpen: () => void
  onCopyPath: () => void
  onCopyRelativePath: () => void
  onClose: () => void
}

export function FileContextMenu({
  x,
  y,
  open,
  path,
  relativePath,
  t,
  onOpen,
  onCopyPath,
  onCopyRelativePath,
  onClose,
}: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside pointerdown
  useEffect(() => {
    if (!open) return

    const handlePointerDown = (e: PointerEvent) => {
      // If the click is inside the menu, do nothing
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

  const handleOpen = useCallback(() => {
    onOpen()
    onClose()
  }, [onOpen, onClose])

  const handleCopyPath = useCallback(() => {
    navigator.clipboard.writeText(path).then(() => {
      onCopyPath()
      onClose()
    })
  }, [path, onCopyPath, onClose])

  const handleCopyRelativePath = useCallback(() => {
    navigator.clipboard.writeText(relativePath).then(() => {
      onCopyRelativePath()
      onClose()
    })
  }, [relativePath, onCopyRelativePath, onClose])

  if (!open) return null

  return (
    <div
      ref={menuRef}
      className="dsh-fe-context-menu"
      role="menu"
      style={{
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      <div
        className="dsh-fe-context-menu-item"
        role="menuitem"
        onClick={handleOpen}
      >
        {t('open')}
      </div>
      <div
        className="dsh-fe-context-menu-item"
        role="menuitem"
        onClick={handleCopyPath}
      >
        {t('copyPath')}
      </div>
      <div
        className="dsh-fe-context-menu-item"
        role="menuitem"
        onClick={handleCopyRelativePath}
      >
        {t('copyRelativePath')}
      </div>
    </div>
  )
}