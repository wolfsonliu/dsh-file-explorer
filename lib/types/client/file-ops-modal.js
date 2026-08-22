import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { basenameOfRel, joinRel } from "./file-ops.js";
import { parentPathOf } from "./tree-search.js";
import { IconChevronRight, IconClose, IconFolderClose } from "./icons.js";
function initialValue(op) {
    return op.kind === 'rename' ? op.entry.name : '';
}
function flattenDirs(dirMap, expanded, rootDirs, path = '', depth = 0) {
    const out = [];
    for (const entry of rootDirs) {
        out.push({ entry, depth });
        if (expanded[entry.path] && dirMap[entry.path]) {
            out.push(...flattenDirs(dirMap, expanded, dirMap[entry.path], entry.path, depth + 1));
        }
    }
    return out;
}
export function FileOpsModal({ op, fileOps, fetchList, sessionId, t, onDone, onCancel }) {
    const [value, setValue] = useState(() => initialValue(op));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [destDir, setDestDir] = useState('');
    const [dirMap, setDirMap] = useState({});
    const [expanded, setExpanded] = useState({});
    const mountedRef = useRef(true);
    useEffect(() => () => { mountedRef.current = false; }, []);
    // move/copy: enumerate root directories; default the destination to root.
    useEffect(() => {
        if (op.kind !== 'move' && op.kind !== 'copy')
            return;
        if (sessionId === undefined)
            return;
        let cancelled = false;
        void fetchList(sessionId, '')
            .then(list => { if (!cancelled)
            setDirMap({ '': list.filter(e => e.kind === 'directory') }); })
            .catch(() => { });
        return () => { cancelled = true; };
    }, [op, sessionId, fetchList]);
    const name = value.trim();
    const canSubmit = name !== '' && !saving;
    const finishInput = async () => {
        if (op.kind !== 'rename' && op.kind !== 'new-file' && op.kind !== 'new-folder')
            return;
        setSaving(true);
        setError(null);
        try {
            let resultPath;
            if (op.kind === 'rename') {
                await fileOps.rename(op.entry.path, name);
                resultPath = joinRel(parentPathOf(op.entry.path), name);
            }
            else if (op.kind === 'new-file') {
                resultPath = joinRel(op.parentDir, name);
                await fileOps.createFile(resultPath);
            }
            else {
                resultPath = joinRel(op.parentDir, name);
                await fileOps.createDir(resultPath);
            }
            onDone(resultPath);
        }
        catch (err) {
            if (!mountedRef.current)
                return;
            setError(err instanceof Error ? err.message : String(err));
            setSaving(false);
        }
    };
    const confirmDelete = async () => {
        if (op.kind !== 'delete')
            return;
        setSaving(true);
        setError(null);
        try {
            await fileOps.remove(op.entry.path);
            onDone(op.entry.path);
        }
        catch (err) {
            if (!mountedRef.current)
                return;
            setError(err instanceof Error ? err.message : String(err));
            setSaving(false);
        }
    };
    const confirmDest = async () => {
        if (op.kind !== 'move' && op.kind !== 'copy')
            return;
        setSaving(true);
        setError(null);
        try {
            if (op.kind === 'move')
                await fileOps.move(op.entry.path, destDir);
            else
                await fileOps.copy(op.entry.path, destDir);
            onDone(joinRel(destDir, basenameOfRel(op.entry.path)));
        }
        catch (err) {
            if (!mountedRef.current)
                return;
            setError(err instanceof Error ? err.message : String(err));
            setSaving(false);
        }
    };
    const toggleDir = (path) => {
        const next = !expanded[path];
        if (next && !dirMap[path]) {
            if (sessionId !== undefined) {
                void fetchList(sessionId, path)
                    .then(list => { if (mountedRef.current)
                    setDirMap(m => ({ ...m, [path]: list.filter(e => e.kind === 'directory') })); })
                    .catch(() => { });
            }
        }
        setExpanded(prev => ({ ...prev, [path]: next }));
    };
    const isExcluded = (path) => {
        if (op.kind !== 'move' && op.kind !== 'copy')
            return false;
        const src = op.entry.path;
        return path === src || path.startsWith(`${src}/`);
    };
    const kind = op.kind;
    const isInput = kind === 'rename' || kind === 'new-file' || kind === 'new-folder';
    const isDest = kind === 'move' || kind === 'copy';
    const submitLabel = kind === 'rename' ? t('confirm') :
        kind === 'delete' ? t('delete') :
            kind === 'move' ? t('moveHere') :
                kind === 'copy' ? t('copyHere') :
                    t('create');
    const title = kind === 'rename' ? t('rename') :
        kind === 'delete' ? t('delete') :
            kind === 'move' ? t('moveTo') :
                kind === 'copy' ? t('copyTo') :
                    kind === 'new-file' ? t('newFile') :
                        t('newFolder');
    const rootDirs = dirMap[''] ?? [];
    const flatDirs = flattenDirs(dirMap, expanded, rootDirs);
    const submit = isInput ? finishInput : kind === 'delete' ? confirmDelete : confirmDest;
    const disabled = isInput ? !canSubmit : saving;
    return (_jsx("div", { className: "dsh-fe-op-overlay", onClick: () => { if (!saving)
            onCancel(); }, children: _jsxs("div", { className: "dsh-fe-op-modal", "data-fe-op": kind, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "dsh-fe-op-header", children: [_jsx("div", { className: "dsh-fe-op-title", children: title }), _jsx("button", { type: "button", className: "dsh-fe-op-close", "data-fe-op-close": true, "aria-label": t('close'), title: t('close'), disabled: saving, onClick: onCancel, children: _jsx(IconClose, { size: 16 }) })] }), _jsxs("div", { className: "dsh-fe-op-body", children: [isInput && (_jsx("input", { className: "dsh-fe-op-input", "data-fe-op-input": true, value: value, autoFocus: true, onFocus: (e) => e.currentTarget.select(), onChange: (e) => setValue(e.target.value), onKeyDown: (e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (canSubmit)
                                        void finishInput();
                                }
                                else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    onCancel();
                                }
                            } })), kind === 'delete' && (_jsx("div", { className: "dsh-fe-op-confirm", children: t('confirmDelete', { name: op.entry.name }) })), isDest && (_jsxs("div", { className: "dsh-fe-op-dir", children: [_jsx("div", { className: "dsh-fe-op-dir-hint", children: t('selectDestination') }), _jsxs("div", { className: "dsh-fe-op-dir-list", children: [_jsx(DirRow, { selected: destDir === '', depth: 0, path: "", name: t('workspaceRoot'), onSelect: () => { if (!saving)
                                                setDestDir(''); } }), flatDirs.map(({ entry, depth }) => (_jsx(DirRow, { selected: destDir === entry.path, depth: depth + 1, path: entry.path, name: entry.name, disabled: isExcluded(entry.path), expanded: !!expanded[entry.path], onSelect: () => { if (!saving && !isExcluded(entry.path))
                                                setDestDir(entry.path); }, onToggle: () => toggleDir(entry.path) }, entry.path)))] })] }))] }), error !== null && _jsxs("div", { className: "dsh-fe-op-error", children: [t('opFailed'), ": ", error] }), _jsxs("div", { className: "dsh-fe-op-actions", children: [_jsx("button", { className: "dsh-fe-op-btn", "data-fe-op-cancel": true, disabled: saving, onClick: onCancel, children: t('cancel') }), _jsx("button", { className: 'dsh-fe-op-btn ' + (kind === 'delete' ? 'dsh-fe-op-btn--danger' : 'dsh-fe-op-btn--primary'), "data-fe-op-submit": true, disabled: disabled, onClick: () => { void submit(); }, children: submitLabel })] })] }) }));
}
function DirRow({ selected, disabled, depth, path, name, expanded, onSelect, onToggle }) {
    return (_jsxs("div", { className: "dsh-fe-op-dir-row", "data-fe-op-dir-row": true, "data-fe-path": path, "data-selected": selected ? 'true' : 'false', "data-disabled": disabled ? 'true' : 'false', style: { paddingLeft: `${depth * 16 + 8}px` }, onClick: disabled ? undefined : onSelect, children: [onToggle !== undefined ? (_jsx("span", { className: "dsh-fe-disclosure", onClick: (e) => {
                    e.stopPropagation();
                    if (disabled)
                        return;
                    onToggle();
                }, children: _jsx(IconChevronRight, { size: 14, style: { transform: expanded ? 'rotate(90deg)' : undefined } }) })) : (_jsx("span", { className: "dsh-fe-spacer" })), _jsx("span", { className: "dsh-fe-icon", children: _jsx(IconFolderClose, { size: 16 }) }), _jsx("span", { className: "dsh-fe-name", children: name })] }));
}
