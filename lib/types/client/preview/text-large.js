import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusPreview, formatBytes } from "./status.js";
const CHUNK_SIZE = 512 * 1024; // 512 KiB
const cache = new Map();
/** Build (and memoize) the built-in paged text renderer for a given reader. */
export function makeTextPagedPreview(readRawFile) {
    const hit = cache.get(readRawFile);
    if (hit !== undefined)
        return hit;
    const Component = (props) => (_jsx(TextPagedPreviewInner, { ...props, readRawFile: readRawFile }));
    cache.set(readRawFile, Component);
    return Component;
}
function TextPagedPreviewInner(props) {
    const { preview } = props;
    if (preview.kind === 'text') {
        return (_jsx("pre", { className: "dsh-fe-code", children: _jsx("code", { children: preview.content }) }));
    }
    if (preview.kind !== 'text-large' || props.readRawFile === undefined) {
        return _jsx(StatusPreview, { ...props });
    }
    return _jsx(PagedContent, { single: props, readRawFile: props.readRawFile, total: preview.size });
}
function PagedContent({ single, readRawFile, total, }) {
    const { preview, filePath, t } = single;
    const [chunks, setChunks] = useState([]);
    const [loaded, setLoaded] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const mountedRef = useRef(true);
    const loadTokenRef = useRef(0);
    const decoderRef = useRef(new TextDecoder('utf-8', { fatal: false }));
    const bodyRef = useRef(null);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);
    // Load the first chunk when this file is shown (also resets on file change).
    useEffect(() => {
        let cancelled = false;
        loadTokenRef.current += 1;
        const token = loadTokenRef.current;
        setError(null);
        setChunks([]);
        setLoaded(0);
        decoderRef.current = new TextDecoder('utf-8', { fatal: false });
        void readRawFile(filePath, 0, CHUNK_SIZE)
            .then((bytes) => {
            if (cancelled || !mountedRef.current || loadTokenRef.current !== token)
                return;
            let text = decoderRef.current.decode(new Uint8Array(bytes), { stream: true });
            if (bytes.byteLength >= total)
                text += decoderRef.current.decode();
            setChunks([text]);
            setLoaded(bytes.byteLength);
        })
            .catch((err) => {
            if (!cancelled && mountedRef.current) {
                setError(err instanceof Error ? err.message : String(err));
            }
        });
        return () => {
            cancelled = true;
        };
    }, [filePath, readRawFile, total]);
    const loadMore = useCallback(() => {
        if (loading || loaded >= total)
            return;
        setLoading(true);
        const offset = loaded;
        const token = loadTokenRef.current;
        void readRawFile(filePath, offset, CHUNK_SIZE)
            .then((bytes) => {
            if (!mountedRef.current || loadTokenRef.current !== token)
                return;
            let text = decoderRef.current.decode(new Uint8Array(bytes), { stream: true });
            if (offset + bytes.byteLength >= total)
                text += decoderRef.current.decode();
            setChunks((prev) => [...prev, text]);
            setLoaded(offset + bytes.byteLength);
        })
            .catch((err) => {
            if (mountedRef.current)
                setError(err instanceof Error ? err.message : String(err));
        })
            .finally(() => {
            if (mountedRef.current)
                setLoading(false);
        });
    }, [filePath, readRawFile, total, loaded, loading]);
    const onScroll = useCallback(() => {
        const el = bodyRef.current;
        if (el === null)
            return;
        if (el.scrollHeight - el.scrollTop - el.clientHeight < 200)
            loadMore();
    }, [loadMore]);
    const hasMore = loaded < total;
    return (_jsxs("div", { className: "dsh-fe-text-large", "data-fe-text-large": true, children: [_jsxs("div", { className: "dsh-fe-text-large-meta", children: [_jsx("span", { className: "dsh-fe-name", children: preview.name }), _jsx("span", { "data-fe-text-large-status": true, children: t('textLoaded', { loaded: formatBytes(loaded), total: formatBytes(total) }) }), _jsx("button", { type: "button", className: "dsh-fe-btn", "data-fe-load-more": true, onClick: loadMore, disabled: loading || !hasMore, children: t('loadMore') })] }), _jsx("div", { className: "dsh-fe-text-large-body", ref: bodyRef, onScroll: onScroll, children: _jsx("pre", { className: "dsh-fe-code", children: _jsx("code", { "data-fe-text-large-content": true, children: chunks.join('') }) }) }), error !== null && _jsx("div", { className: "dsh-fe-preview-error", children: error })] }));
}
