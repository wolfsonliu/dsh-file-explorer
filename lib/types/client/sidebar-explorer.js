import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { forwardRef, useImperativeHandle, useState } from 'react';
import { FileTree } from "./file-tree.js";
/** Sidebar tab bar (「会话 / 文件」) plus the overlay file tree. */
export const SidebarExplorer = forwardRef(function SidebarExplorer({ sessionId, fetchList, onSelectFile }, ref) {
    const [active, setActive] = useState('sessions');
    useImperativeHandle(ref, () => ({
        showFiles: () => setActive('files'),
        showSessions: () => setActive('sessions'),
    }));
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "dsh-fe-sidebar-tabs", children: [_jsx("button", { className: "dsh-fe-sidebar-tab", "data-fe-tab": "sessions", "data-fe-active": active === 'sessions' ? 'true' : 'false', onClick: () => setActive('sessions'), children: "\u4F1A\u8BDD" }), _jsx("button", { className: "dsh-fe-sidebar-tab", "data-fe-tab": "files", "data-fe-active": active === 'files' ? 'true' : 'false', onClick: () => setActive('files'), children: "\u6587\u4EF6" })] }), active === 'files' && (_jsx("div", { className: "dsh-fe-sidebar-tree", "data-fe-tree-visible": "true", children: _jsx(FileTree, { sessionId: sessionId, fetchList: fetchList, onSelectFile: onSelectFile }) }))] }));
});
