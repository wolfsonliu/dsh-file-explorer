import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, } from 'react';
import { VirtualList } from "./virtual-list.js";
import { FileContextMenu } from "./context-menu.js";
import { fileActionsFor } from "./file-action.js";
import { IconChevronRight, IconClose, IconEllipsis, IconFile, IconFolderClose, IconFolderOpen, IconSearch } from "./icons.js";
import { matchesSearch, parentPathOf } from "./tree-search.js";
/** Stable sort: directories before files, then code-point order by name. */
function sortEntries(entries) {
    return [...entries].sort((a, b) => {
        if (a.kind !== b.kind)
            return a.kind === 'directory' ? -1 : 1;
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
}
export const FileTree = forwardRef(function FileTree({ sessionId, helpers, fetchList, t, autoRefresh }, ref) {
    const [entries, setEntries] = useState([]);
    const [children, setChildren] = useState({});
    const [expanded, setExpanded] = useState({});
    const [refreshKey, setRefreshKey] = useState(0);
    const [menu, setMenu] = useState({ open: false, anchor: { x: 0, y: 0 }, entry: null });
    const [query, setQuery] = useState('');
    const childrenRef = useRef(children);
    childrenRef.current = children;
    const refreshingRef = useRef(false);
    const refreshLoadedDirectories = useCallback(() => {
        if (!sessionId || refreshingRef.current)
            return;
        refreshingRef.current = true;
        const reload = (path, isRoot) => {
            fetchList(sessionId, path)
                .then((list) => {
                if (!mountedRef.current)
                    return;
                const sorted = sortEntries(list);
                if (isRoot)
                    setEntries(sorted);
                else
                    setChildren((prev) => ({ ...prev, [path]: sorted }));
            })
                .catch(() => {
                // Ignore polling fetch failures.
            });
        };
        const targets = [
            ['', true],
            ...Object.keys(childrenRef.current).map((p) => [p, false]),
        ];
        void Promise.all(targets.map(([path, isRoot]) => reload(path, isRoot))).finally(() => {
            refreshingRef.current = false;
        });
    }, [sessionId, fetchList]);
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
    useEffect(() => {
        if (!autoRefresh || !sessionId)
            return;
        const poll = setInterval(() => {
            if (document.visibilityState !== 'visible')
                return;
            refreshLoadedDirectories();
        }, 3000);
        const onFocus = () => {
            if (document.visibilityState !== 'visible')
                return;
            refreshLoadedDirectories();
        };
        const onVisibility = () => {
            if (document.visibilityState === 'visible')
                refreshLoadedDirectories();
        };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            clearInterval(poll);
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [autoRefresh, sessionId, refreshLoadedDirectories]);
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
    const handleResultSelect = useCallback((entry) => {
        if (entry.kind === 'file')
            helpers.openFile(entry.path);
        setQuery('');
    }, [helpers]);
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
    const flat = flattenVisible(entries, expanded, children);
    const searching = query.trim() !== '';
    const results = searching ? flat.filter((row) => matchesSearch(row.entry, query)) : [];
    return (_jsxs("div", { className: "dsh-fe-tree", children: [_jsxs("div", { className: "dsh-fe-search-bar", children: [_jsx(IconSearch, { size: 14 }), _jsx("input", { className: "dsh-fe-search", "data-fe-search": true, value: query, onChange: (e) => setQuery(e.target.value), placeholder: t('searchPlaceholder') }), searching && (_jsx("button", { type: "button", className: "dsh-fe-search-clear", "data-fe-search-clear": true, onClick: () => setQuery(''), title: t('clearSearch'), children: _jsx(IconClose, { size: 14 }) }))] }), searching ? (results.length === 0 ? (_jsx("div", { className: "dsh-fe-tree-empty", "data-fe-search-empty": true, children: t('noSearchResults') })) : (_jsx(VirtualList, { rowCount: results.length, rowHeight: TREE_ROW_HEIGHT, rowKey: (i) => results[i].path, renderRow: (i) => (_jsx(SearchResultRow, { entry: results[i].entry, onSelect: handleResultSelect })) }))) : (_jsx(VirtualList, { rowCount: flat.length, rowHeight: TREE_ROW_HEIGHT, rowKey: (i) => flat[i].path, renderRow: (i) => (_jsx(TreeRow, { entry: flat[i].entry, depth: flat[i].depth, expanded: expanded, onDisclosureClick: handleDisclosureClick, helpers: helpers, onOpenMenu: openMenu })) })), _jsx(FileContextMenu, { open: menu.open, anchor: menu.anchor, items: menuItems, onClose: closeMenu })] }));
});
const TREE_ROW_HEIGHT = 28;
/** DFS pre-order of every visible row, derived from the expanded set. */
function flattenVisible(entries, expanded, childrenMap, depth = 0) {
    const out = [];
    for (const entry of entries) {
        out.push({ path: entry.path, depth, entry });
        if (entry.kind === 'directory' && expanded[entry.path] && childrenMap[entry.path]) {
            out.push(...flattenVisible(childrenMap[entry.path], expanded, childrenMap, depth + 1));
        }
    }
    return out;
}
function TreeRow({ entry, depth, expanded, onDisclosureClick, helpers, onOpenMenu }) {
    const isDir = entry.kind === 'directory';
    return (_jsxs("div", { className: 'dsh-fe-tree-row' + (isDir ? ' dsh-fe-tree-row--dir' : ' dsh-fe-tree-row--file'), "data-fe-path": entry.path, "data-fe-kind": entry.kind, style: { paddingLeft: `${depth * 16 + 4}px` }, onClick: () => {
            if (!isDir)
                helpers.openFile(entry.path);
        }, children: [isDir ? (_jsx("span", { className: "dsh-fe-disclosure", onClick: (e) => {
                    e.stopPropagation();
                    onDisclosureClick(entry);
                }, children: _jsx(IconChevronRight, { size: 14, style: { transform: expanded[entry.path] ? 'rotate(90deg)' : undefined, transition: 'transform 0.1s' } }) })) : (_jsx("span", { className: "dsh-fe-spacer" })), _jsx("span", { className: "dsh-fe-icon", children: isDir ? (expanded[entry.path] ? _jsx(IconFolderOpen, { size: 16 }) : _jsx(IconFolderClose, { size: 16 })) : (_jsx(IconFile, { size: 16 })) }), _jsx("span", { className: "dsh-fe-name", children: entry.name }), _jsx("span", { className: "dsh-fe-row-actions", children: _jsx("button", { type: "button", className: "dsh-fe-btn dsh-fe-row-action-btn", "data-fe-action-button": true, onClick: (e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        onOpenMenu(entry, { x: rect.left, y: rect.bottom });
                    }, children: _jsx(IconEllipsis, { size: 16 }) }) })] }));
}
function SearchResultRow({ entry, onSelect }) {
    const isDir = entry.kind === 'directory';
    const parent = parentPathOf(entry.path);
    return (_jsxs("div", { className: 'dsh-fe-search-result' + (isDir ? ' dsh-fe-search-result--dir' : ''), "data-fe-path": entry.path, "data-fe-kind": entry.kind, "data-fe-search-result": true, onClick: () => onSelect(entry), children: [_jsx("span", { className: "dsh-fe-icon", children: isDir ? _jsx(IconFolderClose, { size: 16 }) : _jsx(IconFile, { size: 16 }) }), _jsx("span", { className: "dsh-fe-name", children: entry.name }), parent !== '' && _jsx("span", { className: "dsh-fe-path-hint", children: parent })] }));
}
