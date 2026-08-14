import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from 'react';
import { IconClose, IconPanelLeft } from "./icons.js";
// ---------------------------------------------------------------------------
// FileExplorerDrawer
// ---------------------------------------------------------------------------
export function FileExplorerDrawer({ open, onClose, title, children }) {
    if (!open) {
        return null;
    }
    return (_jsxs("div", { className: "dsh-fe-drawer", "data-fe-drawer": true, children: [_jsxs("div", { className: "dsh-fe-drawer-title", children: [_jsx("span", { className: "dsh-fe-drawer-title-text", children: title ?? '文件浏览器' }), _jsx("button", { className: "dsh-fe-btn", "data-fe-drawer-close": true, onClick: onClose, title: "\u5173\u95ED", children: _jsx(IconClose, { size: 16 }) })] }), _jsx("div", { className: "dsh-fe-drawer-body", children: children })] }));
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
export function FloatingFileButton({ onClick }) {
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
    const movedRef = useRef(false);
    const onPointerDown = (e) => {
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
        if (!movedRef.current && Math.abs(e.clientY - startRef.current.y) <= DRAG_THRESHOLD)
            return;
        movedRef.current = true;
        const maxTop = window.innerHeight - BUTTON_HEIGHT - 8;
        setTop(clamp(startRef.current.top + (e.clientY - startRef.current.y), 8, maxTop));
    };
    const onPointerUp = () => {
        if (!movedRef.current)
            return;
        try {
            localStorage.setItem(BUTTON_TOP_KEY, String(topRef.current));
        }
        catch {
            // ignore persistence failure.
        }
    };
    const handleClick = () => {
        if (movedRef.current)
            return;
        onClick();
    };
    return (_jsxs("button", { className: "dsh-fe-file-button", "data-fe-file-button": true, onClick: handleClick, title: "\u6587\u4EF6\u6D4F\u89C8\u5668\uFF08\u53EF\u4E0A\u4E0B\u62D6\u52A8\uFF09", style: { top }, onPointerDown: onPointerDown, onPointerMove: onPointerMove, onPointerUp: onPointerUp, children: [_jsx(IconPanelLeft, { size: 16 }), _jsx("span", { className: "dsh-fe-file-button-label", children: "\u6587\u4EF6" })] }));
}
