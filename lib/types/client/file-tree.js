import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, } from 'react';
import { VirtualList } from "./virtual-list.js";
import { FileContextMenu } from "./context-menu.js";
import { fileActionsFor } from "./file-action.js";
import { IconChevronRight, IconClose, IconEllipsis, IconFile, IconFolderClose, IconFolderOpen, IconSearch } from "./icons.js";
import { matchesSearch, parentPathOf } from "./tree-search.js";
import { parseSort, sortEntries, SORT_OPTIONS } from "./tree-sort.js";
import { formatRelativeTime } from "./relative-time.js";
import { formatBytes } from "./preview/status.js";
export const FileTree = forwardRef(function FileTree({ sessionId, helpers, fetchList, t, autoRefresh, selectedPath }, ref) {
    const [entries, setEntries] = useState([]);
    const [children, setChildren] = useState({});
    const [expanded, setExpanded] = useState({});
    const [refreshKey, setRefreshKey] = useState(0);
    const [menu, setMenu] = useState({ open: false, getAnchorRect: null, entry: null });
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
    const childrenRef = useRef(children);
    childrenRef.current = children;
    const refreshingRef = useRef(false);
    const sortRef = useRef(sort);
    sortRef.current = sort;
    const refreshLoadedDirectories = useCallback(() => {
        if (!sessionId || refreshingRef.current)
            return;
        refreshingRef.current = true;
        const reload = (path, isRoot) => {
            fetchList(sessionId, path)
                .then((list) => {
                if (!mountedRef.current)
                    return;
                const sorted = sortEntries(list, sortRef.current);
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
            setEntries(sortEntries(list, sortRef.current));
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
    // Re-sort already-fetched entries and children when the sort changes. Async
    // fetch callbacks read `sortRef.current` rather than capturing `sort`, so a
    // fetch that resolves after a change still sorts by the current value.
    useEffect(() => {
        setEntries((prev) => sortEntries(prev, sort));
        setChildren((prev) => {
            const next = {};
            for (const [path, list] of Object.entries(prev))
                next[path] = sortEntries(list, sort);
            return next;
        });
    }, [sort]);
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
                        setChildren((prev) => ({ ...prev, [path]: sortEntries(list, sortRef.current) }));
                    });
                }
            }
            return { ...prev, [path]: next };
        });
    }, [children, fetchList, sessionId]);
    const handleRefresh = useCallback(() => {
        setRefreshKey((k) => k + 1);
    }, []);
    const openMenu = useCallback((entry, getAnchorRect) => {
        setMenu({ open: true, getAnchorRect, entry });
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
            danger: a.danger,
            onSelect: () => a.onSelect(menuEntry, helpers),
        }))
        : [];
    const flat = useMemo(() => flattenVisible(entries, expanded, children), [entries, expanded, children]);
    const flatHeights = useMemo(() => flat.map((row) => (row.entry.kind === 'directory' ? DIR_ROW_HEIGHT : FILE_ROW_HEIGHT)), [flat]);
    const searching = query.trim() !== '';
    const results = searching ? flat.filter((row) => matchesSearch(row.entry, query)) : [];
    return (_jsxs("div", { className: "dsh-fe-tree", children: [_jsxs("div", { className: "dsh-fe-search-bar", children: [_jsx(IconSearch, { size: 14 }), _jsx("input", { className: "dsh-fe-search", "data-fe-search": true, value: query, onChange: (e) => setQuery(e.target.value), placeholder: t('searchPlaceholder') }), searching && (_jsx("button", { type: "button", className: "dsh-fe-search-clear", "data-fe-search-clear": true, onClick: () => setQuery(''), title: t('clearSearch'), children: _jsx(IconClose, { size: 14 }) })), _jsx("select", { className: "dsh-fe-sort", "data-fe-sort": true, "aria-label": t('sortBy'), value: `${sort.key}-${sort.dir}`, onChange: (e) => setSort(parseSort(e.target.value)), title: t('sortBy'), children: SORT_OPTIONS.map((opt) => (_jsx("option", { value: opt.value, children: t(opt.localeKey) }, opt.value))) })] }), searching ? (results.length === 0 ? (_jsx("div", { className: "dsh-fe-tree-empty", "data-fe-search-empty": true, children: t('noSearchResults') })) : (_jsx(VirtualList, { rowCount: results.length, rowHeight: SEARCH_ROW_HEIGHT, rowKey: (i) => results[i].path, renderRow: (i) => (_jsx(SearchResultRow, { entry: results[i].entry, onSelect: handleResultSelect })) }))) : (_jsx(VirtualList, { rowCount: flat.length, rowHeight: flatHeights, rowKey: (i) => flat[i].path, renderRow: (i) => (_jsx(TreeRow, { entry: flat[i].entry, depth: flat[i].depth, expanded: expanded, onDisclosureClick: handleDisclosureClick, helpers: helpers, onOpenMenu: openMenu, selected: selectedPath === flat[i].entry.path, active: isAncestorDir(selectedPath, flat[i].entry), t: t })) })), _jsx(FileContextMenu, { open: menu.open, getAnchorRect: menu.getAnchorRect ?? (() => null), items: menuItems, onClose: closeMenu })] }));
});
const DIR_ROW_HEIGHT = 34;
const FILE_ROW_HEIGHT = 32;
const SEARCH_ROW_HEIGHT = 48;
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
/** Whether a directory entry contains the currently selected (open) path. */
function isAncestorDir(selectedPath, entry) {
    if (selectedPath === null || selectedPath === undefined || entry.kind !== 'directory')
        return false;
    return selectedPath.startsWith(entry.path + '/');
}
function TreeRow({ entry, depth, expanded, selected, active, t, onDisclosureClick, helpers, onOpenMenu }) {
    const isDir = entry.kind === 'directory';
    const className = 'dsh-fe-tree-row' +
        (isDir ? ' dsh-fe-tree-row--dir' : ' dsh-fe-tree-row--file') +
        (selected ? ' dsh-fe-tree-row--selected' : '');
    const meta = isDir
        ? (entry.mtimeMs !== undefined ? formatRelativeTime(t, entry.mtimeMs, Date.now()) : '')
        : (entry.size !== undefined ? formatBytes(entry.size) : '');
    return (_jsxs("div", { className: className, "data-fe-path": entry.path, "data-fe-kind": entry.kind, "data-fe-selected": selected ? 'true' : undefined, style: { paddingLeft: `${depth * 16 + 4}px` }, onClick: () => {
            if (!isDir)
                helpers.openFile(entry.path);
        }, children: [isDir ? (_jsx("span", { className: "dsh-fe-disclosure", onClick: (e) => {
                    e.stopPropagation();
                    onDisclosureClick(entry);
                }, children: _jsx(IconChevronRight, { size: 14, style: { transform: expanded[entry.path] ? 'rotate(90deg)' : undefined, transition: 'transform 0.1s' } }) })) : (_jsx("span", { className: "dsh-fe-spacer" })), _jsx("span", { className: 'dsh-fe-icon' + (active ? ' dsh-fe-icon--active' : ''), children: isDir ? (expanded[entry.path] ? _jsx(IconFolderOpen, { size: 16 }) : _jsx(IconFolderClose, { size: 16 })) : (_jsx(IconFile, { size: 16 })) }), _jsx("span", { className: "dsh-fe-name", children: entry.name }), meta !== '' && _jsx("span", { className: "dsh-fe-row-meta", children: meta }), _jsx("span", { className: "dsh-fe-row-actions", children: _jsx("button", { type: "button", className: "dsh-fe-btn dsh-fe-row-action-btn", "data-fe-action-button": true, onClick: (e) => {
                        e.stopPropagation();
                        const el = e.currentTarget;
                        onOpenMenu(entry, () => (el.isConnected ? el.getBoundingClientRect() : null));
                    }, children: _jsx(IconEllipsis, { size: 16 }) }) })] }));
}
function SearchResultRow({ entry, onSelect }) {
    const isDir = entry.kind === 'directory';
    const parent = parentPathOf(entry.path);
    return (_jsxs("div", { className: 'dsh-fe-search-result' + (isDir ? ' dsh-fe-search-result--dir' : ''), "data-fe-path": entry.path, "data-fe-kind": entry.kind, "data-fe-search-result": true, onClick: () => onSelect(entry), children: [_jsxs("div", { className: "dsh-fe-search-result-heading", children: [_jsx("span", { className: "dsh-fe-icon", children: isDir ? _jsx(IconFolderClose, { size: 16 }) : _jsx(IconFile, { size: 16 }) }), _jsx("span", { className: "dsh-fe-name", children: entry.name })] }), parent !== '' && _jsx("span", { className: "dsh-fe-search-result-meta", children: parent })] }));
}
