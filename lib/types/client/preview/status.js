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
export const StatusPreview = ({ preview, t }) => {
    const sizeStr = formatBytes(preview.size);
    if (preview.kind === 'empty') {
        return (_jsxs("div", { children: [_jsx("p", { children: _jsx("strong", { children: preview.name }) }), _jsx("p", { children: t('emptyFile') })] }));
    }
    if (preview.kind === 'binary') {
        return (_jsxs("div", { children: [_jsx("p", { children: _jsx("strong", { children: preview.name }) }), _jsx("p", { children: t('binary') }), _jsx("p", { children: sizeStr })] }));
    }
    if (preview.kind === 'too-large') {
        return (_jsxs("div", { children: [_jsx("p", { children: _jsx("strong", { children: preview.name }) }), _jsx("p", { children: t('tooLarge') }), _jsx("p", { children: sizeStr })] }));
    }
    return null;
};
