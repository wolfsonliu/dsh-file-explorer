import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useReducer, useRef, } from 'react';
// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------
const DEFAULT_POSITION = { x: 80, y: 80 };
const DEFAULT_SIZE = { width: 640, height: 480 };
const DEFAULT_TREE_WIDTH = 220;
function geometryReducer(state, action) {
    switch (action.type) {
        case 'OPEN':
            return { ...state, visible: true };
        case 'CLOSE':
            return { ...state, visible: false };
        case 'MINIMIZE':
            return { ...state, minimized: !state.minimized };
        case 'MAXIMIZE':
            return { ...state, maximized: !state.maximized, minimized: false };
        case 'MOVE':
            return { ...state, position: action.payload };
        default:
            return state;
    }
}
// ---------------------------------------------------------------------------
// Hook: useDragHandle
// ---------------------------------------------------------------------------
function useDragHandle(onDelta) {
    const draggingRef = useRef(false);
    const lastRef = useRef({ x: 0, y: 0 });
    const rafRef = useRef(0);
    const onDeltaRef = useRef(onDelta);
    onDeltaRef.current = onDelta;
    useEffect(() => {
        const handlePointerMove = (e) => {
            if (!draggingRef.current)
                return;
            if (rafRef.current !== 0) {
                cancelAnimationFrame(rafRef.current);
            }
            rafRef.current = requestAnimationFrame(() => {
                rafRef.current = 0;
                const dx = e.clientX - lastRef.current.x;
                const dy = e.clientY - lastRef.current.y;
                lastRef.current = { x: e.clientX, y: e.clientY };
                onDeltaRef.current(dx, dy);
            });
        };
        const handlePointerUp = () => {
            draggingRef.current = false;
            if (rafRef.current !== 0) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = 0;
            }
        };
        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
        return () => {
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
        };
    }, []);
    const onPointerDown = useCallback((e) => {
        const target = e.currentTarget;
        try {
            target.setPointerCapture(e.pointerId);
        }
        catch {
            // ignore in jsdom
        }
        draggingRef.current = true;
        lastRef.current = { x: e.clientX, y: e.clientY };
    }, []);
    return { onPointerDown };
}
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const FileExplorerPanel = forwardRef(function FileExplorerPanel({ tree, preview, initialVisible = false }, ref) {
    const [geometry, dispatch] = useReducer(geometryReducer, {
        visible: initialVisible,
        minimized: false,
        maximized: false,
        position: DEFAULT_POSITION,
        size: DEFAULT_SIZE,
    });
    // Track visible state for useImperativeHandle toggle
    const visibleRef = useRef(initialVisible);
    visibleRef.current = geometry.visible;
    useImperativeHandle(ref, () => ({
        open: () => dispatch({ type: 'OPEN' }),
        close: () => dispatch({ type: 'CLOSE' }),
        toggle: () => {
            if (visibleRef.current) {
                dispatch({ type: 'CLOSE' });
            }
            else {
                dispatch({ type: 'OPEN' });
            }
        },
    }));
    const treeWidthRef = useRef(DEFAULT_TREE_WIDTH);
    const [, forceUpdate] = useReducer((x) => x + 1, 0);
    // Title bar drag
    const handleTitleDrag = useCallback((dx, dy) => {
        if (geometry.maximized)
            return;
        dispatch({
            type: 'MOVE',
            payload: {
                x: geometry.position.x + dx,
                y: geometry.position.y + dy,
            },
        });
    }, [geometry.position, geometry.maximized]);
    const titleDrag = useDragHandle(handleTitleDrag);
    // Divider drag
    const handleDividerDrag = useCallback((dx, _dy) => {
        const newWidth = Math.max(80, Math.min(600, treeWidthRef.current + dx));
        treeWidthRef.current = newWidth;
        forceUpdate();
    }, []);
    const dividerDrag = useDragHandle(handleDividerDrag);
    if (!geometry.visible) {
        return null;
    }
    const isMaximized = geometry.maximized;
    const panelStyle = isMaximized
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
        };
    return (_jsxs("div", { className: "dsh-fe-panel", "data-visible": geometry.visible, "data-minimized": geometry.minimized, "data-maximized": geometry.maximized, style: panelStyle, children: [_jsxs("div", { className: "dsh-fe-title-bar", "data-fe-title-bar": true, onPointerDown: isMaximized ? undefined : titleDrag.onPointerDown, children: [_jsx("span", { className: "dsh-fe-title-text", children: "\u6587\u4EF6\u6D4F\u89C8\u5668" }), _jsxs("div", { className: "dsh-fe-title-actions", children: [_jsx("button", { className: "dsh-fe-btn", "data-fe-action": "minimize", onClick: () => dispatch({ type: 'MINIMIZE' }), title: geometry.minimized ? '展开' : '最小化', children: geometry.minimized ? '□' : '−' }), _jsx("button", { className: "dsh-fe-btn", "data-fe-action": "maximize", onClick: () => dispatch({ type: 'MAXIMIZE' }), title: isMaximized ? '还原' : '最大化', children: isMaximized ? '❐' : '□' }), _jsx("button", { className: "dsh-fe-btn", "data-fe-action": "close", onClick: () => dispatch({ type: 'CLOSE' }), title: "\u5173\u95ED", children: "\u2715" })] })] }), !geometry.minimized && (_jsxs("div", { className: "dsh-fe-body", "data-fe-body": true, children: [_jsx("div", { className: "dsh-fe-pane dsh-fe-pane--tree", "data-fe-pane": "tree", style: { width: treeWidthRef.current }, children: tree }), _jsx("div", { className: "dsh-fe-divider", "data-fe-divider": true, onPointerDown: dividerDrag.onPointerDown }), _jsx("div", { className: "dsh-fe-pane dsh-fe-pane--preview", "data-fe-pane": "preview", children: preview })] }))] }));
});
