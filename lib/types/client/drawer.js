import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
export function FloatingFileButton({ onClick }) {
    return (_jsxs("button", { className: "dsh-fe-file-button", "data-fe-file-button": true, onClick: onClick, children: [_jsx(IconPanelLeft, { size: 16 }), "\u6587\u4EF6"] }));
}
