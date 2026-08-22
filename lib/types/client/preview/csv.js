import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { parseCsv } from "./csv-parse.js";
import { StatusPreview } from "./status.js";
import { makeTextPagedPreview } from "./text-large.js";
const CSV_MAX_ROWS = 1000;
const CSV_MAX_COLS = 256;
const cache = new Map();
/** Build (and memoize) the built-in CSV preview for a given reader. */
export function makeCsvPreview(readRawFile) {
    const hit = cache.get(readRawFile);
    if (hit !== undefined)
        return hit;
    const Component = (props) => (_jsx(CsvPreviewInner, { ...props, readRawFile: readRawFile }));
    cache.set(readRawFile, Component);
    return Component;
}
function CsvPreviewInner(props) {
    const { preview } = props;
    if (preview.kind === 'text') {
        return _jsx(CsvTable, { content: preview.content, t: props.t });
    }
    // text-large (>2 MiB): reuse the paged text renderer when a reader exists.
    if (preview.kind === 'text-large' && props.readRawFile !== undefined) {
        const Paged = makeTextPagedPreview(props.readRawFile);
        return _jsx(Paged, { ...props });
    }
    return _jsx(StatusPreview, { ...props });
}
function CsvTable({ content, t }) {
    const rows = parseCsv(content);
    if (rows.length === 0) {
        return _jsx("div", { className: "dsh-fe-preview-empty", "data-fe-csv-empty": true, children: t('emptyFile') });
    }
    const header = rows[0];
    const body = rows.slice(1);
    const rowsShown = body.slice(0, CSV_MAX_ROWS);
    const rowsTruncated = body.length > CSV_MAX_ROWS;
    const maxCols = Math.max(header.length, ...rowsShown.map((r) => r.length));
    const colsTruncated = maxCols > CSV_MAX_COLS;
    const cols = Math.min(maxCols, CSV_MAX_COLS);
    const pad = (cells) => {
        const out = cells.slice(0, cols);
        while (out.length < cols)
            out.push('');
        return out;
    };
    return (_jsxs("div", { className: "dsh-fe-csv", "data-fe-csv": true, children: [_jsx("div", { className: "dsh-fe-csv-scroll", children: _jsxs("table", { className: "dsh-fe-table", children: [_jsx("thead", { children: _jsx("tr", { children: pad(header).map((cell, col) => _jsx("th", { scope: "col", children: cell }, col)) }) }), _jsx("tbody", { children: rowsShown.map((row, rowIndex) => (_jsx("tr", { children: pad(row).map((cell, col) => _jsx("td", { children: cell }, col)) }, rowIndex))) })] }) }), (rowsTruncated || colsTruncated) && (_jsxs("div", { className: "dsh-fe-csv-truncated", "data-fe-csv-truncated": true, children: [rowsTruncated && _jsx("span", { children: t('csvTruncated', { rows: CSV_MAX_ROWS }) }), colsTruncated && _jsx("span", { children: t('csvTruncatedCols', { cols: CSV_MAX_COLS }) })] }))] }));
}
