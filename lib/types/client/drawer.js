import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from 'react';
import { IconClose, IconPanelLeft, IconRefresh } from "./icons.js";
// ---------------------------------------------------------------------------
// FileExplorerDrawer
// ---------------------------------------------------------------------------
export function FileExplorerDrawer({ open, onClose, title, onRefresh, t, children, }) {
    if (!open) {
        return null;
    }
    return (_jsxs("div", { className: "dsh-fe-drawer", "data-fe-drawer": true, children: [_jsxs("div", { className: "dsh-fe-drawer-title", children: [_jsx("span", { className: "dsh-fe-drawer-title-text", children: title ?? t('title') }), onRefresh && (_jsx("button", { className: "dsh-fe-btn", "data-fe-action": "refresh", onClick: onRefresh, title: t('refresh'), children: _jsx(IconRefresh, { size: 16 }) })), _jsx("button", { className: "dsh-fe-btn", "data-fe-drawer-close": true, onClick: onClose, title: t('close'), children: _jsx(IconClose, { size: 16 }) })] }), _jsx("div", { className: "dsh-fe-drawer-body", children: children })] }));
}
// ---------------------------------------------------------------------------
// FloatingFileButton
// ---------------------------------------------------------------------------
const BUTTON_TOP_KEY = 'dsh.file-explorer.button-top';
const BUTTON_HEIGHT = 36;
const DRAG_THRESHOLD = 4;
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
export function FloatingFileButton({ onClick, t }) {
    const [top, setTop] = useState(() => {
        try {
            const saved = Number.parseInt(localStorage.getItem(BUTTON_TOP_KEY) ?? '', 10);
            if (Number.isFinite(saved))
                return saved;
        }
        catch {
            // localStorage unavailable (private mode) — fall through to default.
        }
        return Math.round(window.innerHeight / 2) - Math.round(BUTTON_HEIGHT / 2);
    });
    const topRef = useRef(top);
    topRef.current = top;
    const startRef = useRef({ y: 0, top: 0 });
    const downRef = useRef(false);
    const movedRef = useRef(false);
    const onPointerDown = (e) => {
        downRef.current = true;
        startRef.current = { y: e.clientY, top: topRef.current };
        movedRef.current = false;
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        }
        catch {
            // jsdom / non-capturing environments.
        }
    };
    const onPointerMove = (e) => {
        if (!downRef.current)
            return;
        if (!movedRef.current && Math.abs(e.clientY - startRef.current.y) <= DRAG_THRESHOLD)
            return;
        movedRef.current = true;
        const maxTop = window.innerHeight - BUTTON_HEIGHT - 8;
        setTop(clamp(startRef.current.top + (e.clientY - startRef.current.y), 8, maxTop));
    };
    const onPointerUp = () => {
        downRef.current = false;
        if (!movedRef.current)
            return;
        try {
            localStorage.setItem(BUTTON_TOP_KEY, String(topRef.current));
        }
        catch {
            // ignore persistence failure.
        }
    };
    const onPointerCancel = () => {
        downRef.current = false;
    };
    const handleClick = () => {
        if (movedRef.current)
            return;
        onClick();
    };
    return (_jsxs("button", { className: "dsh-fe-file-button", "data-fe-file-button": true, onClick: handleClick, title: t('title'), style: { top }, onPointerDown: onPointerDown, onPointerMove: onPointerMove, onPointerUp: onPointerUp, onPointerCancel: onPointerCancel, children: [_jsx(IconPanelLeft, { size: 16 }), _jsx("span", { className: "dsh-fe-file-button-label", children: t('file') })] }));
}
