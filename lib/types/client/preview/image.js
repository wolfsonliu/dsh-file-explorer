import { jsx as _jsx } from "react/jsx-runtime";
import { StatusPreview } from "./status.js";
export const ImagePreview = (props) => {
    if (props.preview.kind === 'image') {
        return _jsx("img", { src: props.preview.dataUrl, alt: props.preview.name });
    }
    return _jsx(StatusPreview, { ...props });
};
