import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, } from 'react';
import { FileContextMenu } from "./context-menu.js";
import { fileActionsFor } from "./file-action.js";
import { IconChevronRight, IconEllipsis, IconFile, IconFolderClose, IconFolderOpen } from "./icons.js";
/** Stable sort: directories before files, then code-point order by name. */
function sortEntries(entries) {
    return [...entries].sort((a, b) => {
        if (a.kind !== b.kind)
            return a.kind === 'directory' ? -1 : 1;
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
}
export const FileTree = forwardRef(function FileTree({ sessionId, helpers, fetchList, t }, ref) {
    const [entries, setEntries] = useState([]);
    const [children, setChildren] = useState({});
    const [expanded, setExpanded] = useState({});
    const [refreshKey, setRefreshKey] = useState(0);
    const [menu, setMenu] = useState({ open: false, anchor: { x: 0, y: 0 }, entry: null });
    // Track mounted state to avoid setState after unmount
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);
    // Fetch root on mount / sessionId change / refresh
    useEffect(() => {
        if (!sessionId)
            return;
        let cancelled = false;
        fetchList(sessionId, '').then((list) => {
            if (cancelled || !mountedRef.current)
                return;
            setEntries(sortEntries(list));
        });
        return () => {
            cancelled = true;
        };
    }, [sessionId, fetchList, refreshKey]);
    // Reset children and expanded when sessionId changes or refresh
    useEffect(() => {
        setChildren({});
        setExpanded({});
    }, [sessionId, refreshKey]);
    const handleDisclosureClick = useCallback((entry) => {
        const path = entry.path;
        setExpanded((prev) => {
            const next = !prev[path];
            // If expanding and children not yet fetched, fetch them
            if (next && !children[path]) {
                if (sessionId) {
                    fetchList(sessionId, path).then((list) => {
                        if (!mountedRef.current)
                            return;
                        setChildren((prev) => ({ ...prev, [path]: sortEntries(list) }));
                    });
                }
            }
            return { ...prev, [path]: next };
        });
    }, [children, fetchList, sessionId]);
    const handleRefresh = useCallback(() => {
        setRefreshKey((k) => k + 1);
    }, []);
    const openMenu = useCallback((entry, anchor) => {
        setMenu({ open: true, anchor, entry });
    }, []);
    const closeMenu = useCallback(() => {
        setMenu((prev) => ({ ...prev, open: false }));
    }, []);
    useImperativeHandle(ref, () => ({ refresh: handleRefresh }), [handleRefresh]);
    // Empty state
    if (!sessionId) {
        return (_jsx("div", { className: "dsh-fe-tree-empty", children: _jsx("span", { className: "dsh-fe-empty-text", children: t('noSession') }) }));
    }
    const menuEntry = menu.entry;
    const menuItems = menuEntry
        ? fileActionsFor(menuEntry.kind).map((a) => ({
            id: a.id,
            label: a.label(t),
            icon: a.icon,
            onSelect: () => a.onSelect(menuEntry, helpers),
        }))
        : [];
    return (_jsxs("div", { className: "dsh-fe-tree", children: [_jsx("div", { className: "dsh-fe-tree-body", children: _jsx(EntryList, { entries: entries, depth: 0, expanded: expanded, childrenMap: children, onDisclosureClick: handleDisclosureClick, helpers: helpers, onOpenMenu: openMenu }) }), _jsx(FileContextMenu, { open: menu.open, anchor: menu.anchor, items: menuItems, onClose: closeMenu })] }));
});
function EntryList({ entries, depth, expanded, childrenMap, onDisclosureClick, helpers, onOpenMenu, }) {
    return (_jsx(_Fragment, { children: entries.map((entry) => (_jsxs(React.Fragment, { children: [_jsxs("div", { className: 'dsh-fe-tree-row' +
                        (entry.kind === 'directory' ? ' dsh-fe-tree-row--dir' : ' dsh-fe-tree-row--file'), "data-fe-path": entry.path, "data-fe-kind": entry.kind, style: { paddingLeft: `${depth * 16 + 4}px` }, onClick: () => {
                        if (entry.kind === 'file') {
                            helpers.openFile(entry.path);
                        }
                    }, children: [entry.kind === 'directory' ? (_jsx("span", { className: "dsh-fe-disclosure", onClick: (e) => {
                                e.stopPropagation();
                                onDisclosureClick(entry);
                            }, children: _jsx(IconChevronRight, { size: 14, style: {
                                    transform: expanded[entry.path] ? 'rotate(90deg)' : undefined,
                                    transition: 'transform 0.1s',
                                } }) })) : (_jsx("span", { className: "dsh-fe-spacer" })), _jsx("span", { className: "dsh-fe-icon", children: entry.kind === 'directory' ? (expanded[entry.path] ? (_jsx(IconFolderOpen, { size: 16 })) : (_jsx(IconFolderClose, { size: 16 }))) : (_jsx(IconFile, { size: 16 })) }), _jsx("span", { className: "dsh-fe-name", children: entry.name }), _jsx("span", { className: "dsh-fe-row-actions", children: _jsx("button", { type: "button", className: "dsh-fe-btn dsh-fe-row-action-btn", "data-fe-action-button": true, onClick: (e) => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    onOpenMenu(entry, { x: rect.left, y: rect.bottom });
                                }, children: _jsx(IconEllipsis, { size: 16 }) }) })] }), entry.kind === 'directory' &&
                    expanded[entry.path] &&
                    childrenMap[entry.path] && (_jsx(EntryList, { entries: childrenMap[entry.path], depth: depth + 1, expanded: expanded, childrenMap: childrenMap, onDisclosureClick: onDisclosureClick, helpers: helpers, onOpenMenu: onOpenMenu }))] }, entry.path))) }));
}
