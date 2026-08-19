import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export interface VirtualListProps {
  rowCount: number
  rowHeight: number
  /** Stable identity per row index (used as the React key). */
  rowKey: (index: number) => string | number
  /** Extra rows rendered above/below the visible viewport. */
  overscan?: number
  className?: string
  renderRow: (index: number) => ReactNode
}

export function VirtualList({
  rowCount,
  rowHeight,
  rowKey,
  overscan = 10,
  className,
  renderRow,
}: VirtualListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [range, setRange] = useState({ start: 0, end: Math.min(rowCount, 50) })

  const updateRange = useCallback(() => {
    const el = containerRef.current
    if (el === null) return
    const viewport = el.clientHeight
    // Unmeasured viewport (jsdom): render everything.
    if (viewport <= 0) {
      setRange((prev) => (prev.start === 0 && prev.end === rowCount ? prev : { start: 0, end: rowCount }))
      return
    }
    const start = Math.max(0, Math.floor(el.scrollTop / rowHeight) - overscan)
    const end = Math.min(rowCount, Math.ceil((el.scrollTop + viewport) / rowHeight) + overscan)
    setRange({ start, end })
  }, [rowHeight, overscan, rowCount])

  useEffect(() => {
    updateRange()
    window.addEventListener('resize', updateRange)
    return () => window.removeEventListener('resize', updateRange)
  }, [updateRange])

  const handleScroll = useCallback(() => {
    updateRange()
  }, [updateRange])

  const totalHeight = rowCount * rowHeight
  const visible: number[] = []
  const end = Math.min(range.end, rowCount)
  for (let i = range.start; i < end; i++) visible.push(i)

  return (
    <div
      ref={containerRef}
      className={'dsh-fe-virtual-list' + (className !== undefined ? ` ${className}` : '')}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visible.map((i) => (
          <div
            key={rowKey(i)}
            style={{ position: 'absolute', top: i * rowHeight, left: 0, right: 0, height: rowHeight }}
          >
            {renderRow(i)}
          </div>
        ))}
      </div>
    </div>
  )
}