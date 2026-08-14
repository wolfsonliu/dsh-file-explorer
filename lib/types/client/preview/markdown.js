import { jsx as _jsx } from "react/jsx-runtime";
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { StatusPreview } from "./status.js";
export const MarkdownPreview = (props) => {
    if (props.preview.kind === 'text') {
        if (props.activeView === 'source') {
            return (_jsx("pre", { children: _jsx("code", { children: props.preview.content }) }));
        }
        const html = DOMPurify.sanitize(marked.parse(props.preview.content));
        return _jsx("div", { dangerouslySetInnerHTML: { __html: html } });
    }
    return _jsx(StatusPreview, { ...props });
};
