import { jsx as _jsx } from "react/jsx-runtime";
import { StatusPreview } from "./status.js";
export const TextPreview = (props) => {
    if (props.preview.kind === 'text') {
        return (_jsx("pre", { children: _jsx("code", { children: props.preview.content }) }));
    }
    return _jsx(StatusPreview, { ...props });
};
