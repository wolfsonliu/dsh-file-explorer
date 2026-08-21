import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import { IconClose, IconFullscreen } from './icons.tsx'
import type { Translate } from './locale.ts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileExplorerPanelHandle {
  open: () => void
  close: () => void
  toggle: () => void
}

export interface FileExplorerPanelProps {
  /** Optional title text (defaults to the localized title). */
  title?: string
  /** Translator for localized UI copy. */
  t: Translate
  /** Preview content rendered in the body. */
  children: ReactNode
  initialVisible?: boolean
  /** Called synchronously just before the panel is closed via the close button. */
  onClose?: () => void
}

export interface Position {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

interface Geometry {
  visible: boolean
  maximized: boolean
  position: Position
  size: Size
}

type Action =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'MAXIMIZE' }
  | { type: 'MOVE'; payload: Position }
  | { type: 'RESIZE'; payload: Size }

// ---------------------------------------------------------------------------
// Viewport clamping
// ---------------------------------------------------------------------------

/** 标题栏高度；必须与 styles.ts 的 `.dsh-fe-title-bar { height: 32px }` 保持一致。 */
export const TITLE_BAR_HEIGHT = 32

export interface Viewport {
  width: number
  height: number
}

/** 把面板位置钳制到视口内，保证 32px 标题栏始终完整可见。 */
export function clampToViewport(
  position: Position,
  size: Size,
  viewport: Viewport,
): Position {
  const maxTop = Math.max(0, viewport.height - TITLE_BAR_HEIGHT)
  const maxLeft = Math.max(0, viewport.width - size.width)
  return {
    x: Math.max(0, Math.min(maxLeft, position.x)),
    y: Math.max(0, Math.min(maxTop, position.y)),
  }
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

const DEFAULT_POSITION: Position = { x: 80, y: 80 }
const DEFAULT_SIZE: Size = { width: 640, height: 480 }
const MIN_SIZE: Size = { width: 320, height: 240 }

function geometryReducer(state: Geometry, action: Action): Geometry {
  switch (action.type) {
    case 'OPEN':
      return { ...state, visible: true }
    case 'CLOSE':
      return { ...state, visible: false }
    case 'MAXIMIZE':
      return { ...state, maximized: !state.maximized }
    case 'MOVE':
      return { ...state, position: action.payload }
    case 'RESIZE':
      return {
        ...state,
        size: {
          width: Math.max(MIN_SIZE.width, action.payload.width),
          height: Math.max(MIN_SIZE.height, action.payload.height),
        },
      }
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

export const FileExplorerPanel = forwardRef<FileExplorerPanelHandle, FileExplorerPanelProps>(
  function FileExplorerPanel({ title, t, children, onClose, initialVisible = false }, ref) {
    const [geometry, dispatch] = useReducer(geometryReducer, {
      visible: initialVisible,
      maximized: false,
      position: DEFAULT_POSITION,
      size: DEFAULT_SIZE,
    })

    const visibleRef = useRef(initialVisible)
    visibleRef.current = geometry.visible

    useImperativeHandle(ref, () => ({
      open: () => dispatch({ type: 'OPEN' }),
      close: () => dispatch({ type: 'CLOSE' }),
      toggle: () => {
        if (visibleRef.current) {
          dispatch({ type: 'CLOSE' })
        } else {
          dispatch({ type: 'OPEN' })
        }
      },
    }))

    // Title drag (moves the panel). Bound to the title TEXT only, so the
    // action buttons keep their own click handling without pointer-capture
    // interference.
    const handleTitleDrag = useCallback(
      (dx: number, dy: number) => {
        if (geometry.maximized) return
        const viewport = { width: window.innerWidth, height: window.innerHeight }
        dispatch({
          type: 'MOVE',
          payload: clampToViewport(
            { x: geometry.position.x + dx, y: geometry.position.y + dy },
            geometry.size,
            viewport,
          ),
        })
      },
      [geometry.position, geometry.maximized, geometry.size],
    )
    const titleDrag = useDragHandle(handleTitleDrag)

    // Resize drag (bottom-right corner handle).
    const handleResizeDrag = useCallback(
      (dx: number, dy: number) => {
        dispatch({
          type: 'RESIZE',
          payload: {
            width: geometry.size.width + dx,
            height: geometry.size.height + dy,
          },
        })
      },
      [geometry.size],
    )
    const resizeDrag = useDragHandle(handleResizeDrag)

    // Re-clamp whenever the viewport shrinks or maximized is restored, so the
    // 32px title bar always stays reachable. A ref holds the latest geometry
    // (same pattern as useDragHandle's onDeltaRef); the effect only re-runs on
    // maximized changes, avoiding listener churn on every drag.
    const geometryRef = useRef(geometry)
    geometryRef.current = geometry

    useEffect(() => {
      if (geometry.maximized) return

      const reClamp = () => {
        const viewport = { width: window.innerWidth, height: window.innerHeight }
        const { position, size } = geometryRef.current
        const clamped = clampToViewport(position, size, viewport)
        if (clamped.x !== position.x || clamped.y !== position.y) {
          dispatch({ type: 'MOVE', payload: clamped })
        }
      }

      reClamp()
      window.addEventListener('resize', reClamp)

      return () => {
        window.removeEventListener('resize', reClamp)
      }
    }, [geometry.maximized])

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
        data-maximized={geometry.maximized}
        style={panelStyle}
      >
        {/* Title Bar */}
        <div className="dsh-fe-title-bar" data-fe-title-bar>
          <span
            className="dsh-fe-title-text"
            onPointerDown={isMaximized ? undefined : titleDrag.onPointerDown}
          >
            {title ?? t('title')}
          </span>
          <div className="dsh-fe-title-actions">
            <button
              className="dsh-fe-btn"
              data-fe-action="maximize"
              onClick={() => dispatch({ type: 'MAXIMIZE' })}
              title={isMaximized ? t('restore') : t('maximize')}
            >
              <IconFullscreen size={16} />
            </button>
            <button
              className="dsh-fe-btn"
              data-fe-action="close"
              onClick={() => {
                onClose?.()
                dispatch({ type: 'CLOSE' })
              }}
              title={t('close')}
            >
              <IconClose size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="dsh-fe-body" data-fe-body>
          {children}
        </div>

        {/* Resize handle (bottom-right corner) */}
        {!isMaximized && (
          <div
            className="dsh-fe-resize-handle"
            data-fe-resize
            onPointerDown={resizeDrag.onPointerDown}
          />
        )}
      </div>
    )
  },
)
