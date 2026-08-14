import React, { forwardRef, useImperativeHandle, useState } from 'react'
import type { BrowserEntry } from '../protocol.ts'
import { FileTree } from './file-tree.tsx'

export interface SidebarExplorerProps {
  sessionId: string | undefined
  fetchList: (sessionId: string, path: string) => Promise<BrowserEntry[]>
  onSelectFile: (path: string) => void
}

export interface SidebarExplorerHandle {
  showFiles(): void
  showSessions(): void
}

type Tab = 'sessions' | 'files'

/** Sidebar tab bar (「会话 / 文件」) plus the overlay file tree. */
export const SidebarExplorer = forwardRef<SidebarExplorerHandle, SidebarExplorerProps>(
  function SidebarExplorer({ sessionId, fetchList, onSelectFile }, ref) {
    const [active, setActive] = useState<Tab>('sessions')

    useImperativeHandle(ref, () => ({
      showFiles: () => setActive('files'),
      showSessions: () => setActive('sessions'),
    }))

    return (
      <>
        <div className="dsh-fe-sidebar-tabs">
          <button
            className="dsh-fe-sidebar-tab"
            data-fe-tab="sessions"
            data-fe-active={active === 'sessions' ? 'true' : 'false'}
            onClick={() => setActive('sessions')}
          >
            会话
          </button>
          <button
            className="dsh-fe-sidebar-tab"
            data-fe-tab="files"
            data-fe-active={active === 'files' ? 'true' : 'false'}
            onClick={() => setActive('files')}
          >
            文件
          </button>
        </div>
        {active === 'files' && (
          <div className="dsh-fe-sidebar-tree" data-fe-tree-visible="true">
            <FileTree sessionId={sessionId} fetchList={fetchList} onSelectFile={onSelectFile} />
          </div>
        )}
      </>
    )
  },
)
