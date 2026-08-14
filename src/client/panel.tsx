import React, { useCallback, useEffect, useReducer, useRef, type ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileExplorerPanelProps {
  tree: ReactNode
  preview: ReactNode
  initialVisible?: boolean
}

interface Position {
  x: number
  y: number
}

interface Size {
  width: number
  height: number
}

interface Geometry {
  visible: boolean
  minimized: boolean
  maximized: boolean
  position: Position
  size: Size
}

type Action =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'MINIMIZE' }
  | { type: 'MAXIMIZE' }
  | { type: 'MOVE'; payload: Position }

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

const DEFAULT_POSITION: Position = { x: 80, y: 80 }
const DEFAULT_SIZE: Size = { width: 640, height: 480 }
const DEFAULT_TREE_WIDTH = 220

function geometryReducer(state: Geometry, action: Action): Geometry {
  switch (action.type) {
    case 'OPEN':
      return { ...state, visible: true }
    case 'CLOSE':
      return { ...state, visible: false }
    case 'MINIMIZE':
      return { ...state, minimized: !state.minimized }
    case 'MAXIMIZE':
      return { ...state, maximized: !state.maximized, minimized: false }
    case 'MOVE':
      return { ...state, position: action.payload }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Hook: useDragHandle
// ---------------------------------------------------------------------------

function useDragHandle(
  onDelta: (dx: number, dy: number) => void,
): {
  onPointerDown: (e: React.PointerEvent) => void
} {
  const draggingRef = useRef(false)
  const lastRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const rafRef = useRef<number>(0)
  const onDeltaRef = useRef(onDelta)
  onDeltaRef.current = onDelta

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!draggingRef.current) return

      if (rafRef.current !== 0) {
        cancelAnimationFrame(rafRef.current)
      }

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        const dx = e.clientX - lastRef.current.x
        const dy = e.clientY - lastRef.current.y
        lastRef.current = { x: e.clientX, y: e.clientY }
        onDeltaRef.current(dx, dy)
      })
    }

    const handlePointerUp = () => {
      draggingRef.current = false
      if (rafRef.current !== 0) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)

    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.currentTarget as Element
    try {
      target.setPointerCapture(e.pointerId)
    } catch {
      // ignore in jsdom
    }
    draggingRef.current = true
    lastRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  return { onPointerDown }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FileExplorerPanel({
  tree,
  preview,
  initialVisible = false,
}: FileExplorerPanelProps) {
  const [geometry, dispatch] = useReducer(geometryReducer, {
    visible: initialVisible,
    minimized: false,
    maximized: false,
    position: DEFAULT_POSITION,
    size: DEFAULT_SIZE,
  })

  const treeWidthRef = useRef(DEFAULT_TREE_WIDTH)
  const [, forceUpdate] = useReducer((x) => x + 1, 0)

  // Title bar drag
  const handleTitleDrag = useCallback(
    (dx: number, dy: number) => {
      if (geometry.maximized) return
      dispatch({
        type: 'MOVE',
        payload: {
          x: geometry.position.x + dx,
          y: geometry.position.y + dy,
        },
      })
    },
    [geometry.position, geometry.maximized],
  )

  const titleDrag = useDragHandle(handleTitleDrag)

  // Divider drag
  const handleDividerDrag = useCallback(
    (dx: number, _dy: number) => {
      const newWidth = Math.max(80, Math.min(600, treeWidthRef.current + dx))
      treeWidthRef.current = newWidth
      forceUpdate()
    },
    [],
  )

  const dividerDrag = useDragHandle(handleDividerDrag)

  if (!geometry.visible) {
    return null
  }

  const isMaximized = geometry.maximized

  const panelStyle: React.CSSProperties = isMaximized
    ? {
        left: 0,
        top: 0,
        width: '100vw',
        height: '100vh',
      }
    : {
        left: geometry.position.x,
        top: geometry.position.y,
        width: geometry.size.width,
        height: geometry.size.height,
      }

  return (
    <div
      className="dsh-fe-panel"
      data-visible={geometry.visible}
      data-minimized={geometry.minimized}
      data-maximized={geometry.maximized}
      style={panelStyle}
    >
      {/* Title Bar */}
      <div
        className="dsh-fe-title-bar"
        data-fe-title-bar
        onPointerDown={isMaximized ? undefined : titleDrag.onPointerDown}
      >
        <span className="dsh-fe-title-text">文件浏览器</span>
        <div className="dsh-fe-title-actions">
          <button
            className="dsh-fe-btn"
            data-fe-action="minimize"
            onClick={() => dispatch({ type: 'MINIMIZE' })}
            title={geometry.minimized ? '展开' : '最小化'}
          >
            {geometry.minimized ? '□' : '−'}
          </button>
          <button
            className="dsh-fe-btn"
            data-fe-action="maximize"
            onClick={() => dispatch({ type: 'MAXIMIZE' })}
            title={isMaximized ? '还原' : '最大化'}
          >
            {isMaximized ? '❐' : '□'}
          </button>
          <button
            className="dsh-fe-btn"
            data-fe-action="close"
            onClick={() => dispatch({ type: 'CLOSE' })}
            title="关闭"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      {!geometry.minimized && (
        <div className="dsh-fe-body" data-fe-body>
          <div
            className="dsh-fe-pane dsh-fe-pane--tree"
            data-fe-pane="tree"
            style={{ width: treeWidthRef.current }}
          >
            {tree}
          </div>
          <div
            className="dsh-fe-divider"
            data-fe-divider
            onPointerDown={dividerDrag.onPointerDown}
          />
          <div className="dsh-fe-pane dsh-fe-pane--preview" data-fe-pane="preview">
            {preview}
          </div>
        </div>
      )}
    </div>
  )
}