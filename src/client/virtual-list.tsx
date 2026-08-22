import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export interface VirtualListProps {
  rowCount: number
  /** Constant height, or a per-index height for variable-height rows. */
  rowHeight: number | ((index: number) => number)
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
  const [range, setRange] = useState({ start: 0, end: rowCount })

  const heights = useMemo(() => {
    const hs: number[] = []
    for (let i = 0; i < rowCount; i++) {
      hs.push(typeof rowHeight === 'number' ? rowHeight : rowHeight(i))
    }
    return hs
  }, [rowCount, rowHeight])

  // Prefix sums so variable-height rows resolve to absolute offsets in O(log n).
  const offsets = useMemo(() => {
    const off: number[] = new Array(rowCount + 1)
    off[0] = 0
    for (let i = 0; i < rowCount; i++) off[i + 1] = off[i] + heights[i]
    return off
  }, [heights, rowCount])

  const totalHeight = offsets[rowCount]

  const indexAt = useCallback(
    (y: number): number => {
      let lo = 0
      let hi = rowCount
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (offsets[mid + 1] <= y) lo = mid + 1
        else hi = mid
      }
      return lo
    },
    [offsets, rowCount],
  )

  const updateRange = useCallback(() => {
    const el = containerRef.current
    if (el === null) return
    const viewport = el.clientHeight
    // Unmeasured viewport (jsdom): render everything.
    if (viewport <= 0) {
      setRange((prev) => (prev.start === 0 && prev.end === rowCount ? prev : { start: 0, end: rowCount }))
      return
    }
    const start = Math.max(0, indexAt(el.scrollTop) - overscan)
    const end = Math.min(rowCount, indexAt(el.scrollTop + viewport) + overscan)
    setRange({ start, end })
  }, [indexAt, overscan, rowCount])

  useEffect(() => {
    updateRange()
    window.addEventListener('resize', updateRange)
    return () => window.removeEventListener('resize', updateRange)
  }, [updateRange])

  const handleScroll = useCallback(() => {
    updateRange()
  }, [updateRange])

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
            style={{ position: 'absolute', top: offsets[i], left: 0, right: 0, height: heights[i] }}
          >
            {renderRow(i)}
          </div>
        ))}
      </div>
    </div>
  )
}