import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Format a byte count into a human-readable string. */
export function formatBytes(bytes) {
    if (bytes === 0)
        return '0 B';
    if (bytes < 1024)
        return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024)
        return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
}
export const StatusPreview = ({ preview, filePath }) => {
    const sizeStr = formatBytes(preview.size);
    if (preview.kind === 'empty') {
        return (_jsxs("div", { children: [_jsx("p", { children: _jsx("strong", { children: preview.name }) }), _jsx("p", { children: "\u7A7A\u6587\u4EF6" })] }));
    }
    if (preview.kind === 'binary') {
        return (_jsxs("div", { children: [_jsx("p", { children: _jsx("strong", { children: preview.name }) }), _jsx("p", { children: "\u65E0\u6CD5\u9884\u89C8\u6B64\u6587\u4EF6\uFF08\u4E8C\u8FDB\u5236\uFF09" }), _jsx("p", { children: sizeStr })] }));
    }
    if (preview.kind === 'too-large') {
        return (_jsxs("div", { children: [_jsx("p", { children: _jsx("strong", { children: preview.name }) }), _jsx("p", { children: "\u6587\u4EF6\u8FC7\u5927\uFF0C\u65E0\u6CD5\u9884\u89C8" }), _jsx("p", { children: sizeStr })] }));
    }
    return null;
};
