import React, { type ReactNode } from 'react'
import { IconClose, IconPanelLeft } from './icons.tsx'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileExplorerDrawerProps {
  open: boolean
  onClose: () => void
  /** Optional title text (default '文件浏览器'). */
  title?: string
  /** The file tree. */
  children: ReactNode
}

// ---------------------------------------------------------------------------
// FileExplorerDrawer
// ---------------------------------------------------------------------------

export function FileExplorerDrawer({ open, onClose, title, children }: FileExplorerDrawerProps) {
  if (!open) {
    return null
  }

  return (
    <div className="dsh-fe-drawer" data-fe-drawer>
      <div className="dsh-fe-drawer-title">
        <span className="dsh-fe-drawer-title-text">{title ?? '文件浏览器'}</span>
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

export function FloatingFileButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="dsh-fe-file-button" data-fe-file-button onClick={onClick}>
      <IconPanelLeft size={16} />
      文件
    </button>
  )
}
