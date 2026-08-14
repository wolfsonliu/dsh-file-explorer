const registry = new Map();
const FALLBACK_KEY = 'binary';
/** Register (or replace) the preview component for a file extension. */
export function registerPreview(ext, component) {
    registry.set(ext.toLowerCase(), component);
}
/** The registry key for an extension: itself if registered, else the fallback. */
export function previewKeyOf(ext) {
    return registry.has(ext.toLowerCase()) ? ext.toLowerCase() : FALLBACK_KEY;
}
/** Resolve the preview component for an extension, falling back to 'binary'. */
export function resolvePreview(ext) {
    return registry.get(previewKeyOf(ext)) ?? registry.get(FALLBACK_KEY);
}
