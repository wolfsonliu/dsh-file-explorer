import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useReducer, useRef, } from 'react';
import { IconClose, IconFullscreen } from "./icons.js";
// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------
const DEFAULT_POSITION = { x: 80, y: 80 };
const DEFAULT_SIZE = { width: 640, height: 480 };
const MIN_SIZE = { width: 320, height: 240 };
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
        case 'RESIZE':
            return {
                ...state,
                size: {
                    width: Math.max(MIN_SIZE.width, action.payload.width),
                    height: Math.max(MIN_SIZE.height, action.payload.height),
                },
            };
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
export const FileExplorerPanel = forwardRef(function FileExplorerPanel({ title, t, children, initialVisible = false }, ref) {
    const [geometry, dispatch] = useReducer(geometryReducer, {
        visible: initialVisible,
        minimized: false,
        maximized: false,
        position: DEFAULT_POSITION,
        size: DEFAULT_SIZE,
    });
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
    // Title drag (moves the panel). Bound to the title TEXT only, so the
    // action buttons keep their own click handling without pointer-capture
    // interference.
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
    // Resize drag (bottom-right corner handle).
    const handleResizeDrag = useCallback((dx, dy) => {
        dispatch({
            type: 'RESIZE',
            payload: {
                width: geometry.size.width + dx,
                height: geometry.size.height + dy,
            },
        });
    }, [geometry.size]);
    const resizeDrag = useDragHandle(handleResizeDrag);
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
    return (_jsxs("div", { className: "dsh-fe-panel", "data-visible": geometry.visible, "data-minimized": geometry.minimized, "data-maximized": geometry.maximized, style: panelStyle, children: [_jsxs("div", { className: "dsh-fe-title-bar", "data-fe-title-bar": true, children: [_jsx("span", { className: "dsh-fe-title-text", onPointerDown: isMaximized ? undefined : titleDrag.onPointerDown, children: title ?? t('title') }), _jsxs("div", { className: "dsh-fe-title-actions", children: [_jsx("button", { className: "dsh-fe-btn", "data-fe-action": "minimize", onClick: () => dispatch({ type: 'MINIMIZE' }), title: geometry.minimized ? t('restore') : t('minimize'), children: geometry.minimized ? '□' : '−' }), _jsx("button", { className: "dsh-fe-btn", "data-fe-action": "maximize", onClick: () => dispatch({ type: 'MAXIMIZE' }), title: isMaximized ? t('restore') : t('maximize'), children: _jsx(IconFullscreen, { size: 16 }) }), _jsx("button", { className: "dsh-fe-btn", "data-fe-action": "close", onClick: () => dispatch({ type: 'CLOSE' }), title: t('close'), children: _jsx(IconClose, { size: 16 }) })] })] }), !geometry.minimized && (_jsx("div", { className: "dsh-fe-body", "data-fe-body": true, children: children })), !isMaximized && (_jsx("div", { className: "dsh-fe-resize-handle", "data-fe-resize": true, onPointerDown: resizeDrag.onPointerDown }))] }));
});
