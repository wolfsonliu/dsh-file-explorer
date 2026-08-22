import { jsx as _jsx } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
export function VirtualList({ rowCount, rowHeight, rowKey, overscan = 10, className, renderRow, }) {
    const containerRef = useRef(null);
    const [range, setRange] = useState({ start: 0, end: rowCount });
    const heights = useMemo(() => {
        const hs = [];
        for (let i = 0; i < rowCount; i++) {
            hs.push(typeof rowHeight === 'number' ? rowHeight : rowHeight(i));
        }
        return hs;
    }, [rowCount, rowHeight]);
    // Prefix sums so variable-height rows resolve to absolute offsets in O(log n).
    const offsets = useMemo(() => {
        const off = new Array(rowCount + 1);
        off[0] = 0;
        for (let i = 0; i < rowCount; i++)
            off[i + 1] = off[i] + heights[i];
        return off;
    }, [heights, rowCount]);
    const totalHeight = offsets[rowCount];
    const indexAt = useCallback((y) => {
        let lo = 0;
        let hi = rowCount;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (offsets[mid + 1] <= y)
                lo = mid + 1;
            else
                hi = mid;
        }
        return lo;
    }, [offsets, rowCount]);
    const updateRange = useCallback(() => {
        const el = containerRef.current;
        if (el === null)
            return;
        const viewport = el.clientHeight;
        // Unmeasured viewport (jsdom): render everything.
        if (viewport <= 0) {
            setRange((prev) => (prev.start === 0 && prev.end === rowCount ? prev : { start: 0, end: rowCount }));
            return;
        }
        const start = Math.max(0, indexAt(el.scrollTop) - overscan);
        const end = Math.min(rowCount, indexAt(el.scrollTop + viewport) + overscan);
        setRange({ start, end });
    }, [indexAt, overscan, rowCount]);
    useEffect(() => {
        updateRange();
        window.addEventListener('resize', updateRange);
        return () => window.removeEventListener('resize', updateRange);
    }, [updateRange]);
    const handleScroll = useCallback(() => {
        updateRange();
    }, [updateRange]);
    const visible = [];
    const end = Math.min(range.end, rowCount);
    for (let i = range.start; i < end; i++)
        visible.push(i);
    return (_jsx("div", { ref: containerRef, className: 'dsh-fe-virtual-list' + (className !== undefined ? ` ${className}` : ''), onScroll: handleScroll, children: _jsx("div", { style: { height: totalHeight, position: 'relative' }, children: visible.map((i) => (_jsx("div", { style: { position: 'absolute', top: offsets[i], left: 0, right: 0, height: heights[i] }, children: renderRow(i) }, rowKey(i)))) }) }));
}
