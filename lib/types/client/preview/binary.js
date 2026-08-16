import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { StatusPreview, formatBytes } from "./status.js";
import { hexdump } from "./hexdump.js";
/** Decode a base64 string into a Uint8Array (browser `atob`). */
function decodeBase64(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}
export const BinaryPreview = (props) => {
    const { preview, t } = props;
    if (preview.kind !== 'binary') {
        return _jsx(StatusPreview, { ...props });
    }
    const bytes = decodeBase64(preview.bytes);
    const text = hexdump(bytes);
    return (_jsxs("div", { className: "dsh-fe-hex", children: [_jsxs("div", { className: "dsh-fe-hex-meta", children: [_jsx("span", { children: formatBytes(preview.size) }), preview.truncated && (_jsx("span", { children: t('hexTruncated', { shown: formatBytes(bytes.length), total: formatBytes(preview.size) }) }))] }), _jsx("pre", { className: "dsh-fe-code", children: _jsx("code", { children: text }) })] }));
};
