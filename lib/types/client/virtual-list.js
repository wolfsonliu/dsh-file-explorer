import { jsx as _jsx } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
export function VirtualList({ rowCount, rowHeight, rowKey, overscan = 10, className, renderRow, }) {
    const containerRef = useRef(null);
    const [range, setRange] = useState({ start: 0, end: Math.min(rowCount, 50) });
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
        const start = Math.max(0, Math.floor(el.scrollTop / rowHeight) - overscan);
        const end = Math.min(rowCount, Math.ceil((el.scrollTop + viewport) / rowHeight) + overscan);
        setRange({ start, end });
    }, [rowHeight, overscan, rowCount]);
    useEffect(() => {
        updateRange();
        window.addEventListener('resize', updateRange);
        return () => window.removeEventListener('resize', updateRange);
    }, [updateRange]);
    const handleScroll = useCallback(() => {
        updateRange();
    }, [updateRange]);
    const totalHeight = rowCount * rowHeight;
    const visible = [];
    const end = Math.min(range.end, rowCount);
    for (let i = range.start; i < end; i++)
        visible.push(i);
    return (_jsx("div", { ref: containerRef, className: 'dsh-fe-virtual-list' + (className !== undefined ? ` ${className}` : ''), onScroll: handleScroll, children: _jsx("div", { style: { height: totalHeight, position: 'relative' }, children: visible.map((i) => (_jsx("div", { style: { position: 'absolute', top: i * rowHeight, left: 0, right: 0, height: rowHeight }, children: renderRow(i) }, rowKey(i)))) }) }));
}
