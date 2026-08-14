const registry = new Map();
const FALLBACK_KEY = 'binary';
/**
 * Register a preview component for a file extension, returning a disposer that
 * removes this exact entry (idempotently). Higher priority wins at resolution;
 * among equal priorities the later-registered entry wins.
 */
export function registerPreview(ext, component, priority = 0) {
    const key = ext.toLowerCase();
    const entries = registry.get(key) ?? [];
    const entry = { component, priority };
    entries.push(entry);
    registry.set(key, entries);
    let disposed = false;
    return () => {
        if (disposed)
            return;
        disposed = true;
        const remaining = entries.filter((e) => e !== entry);
        if (remaining.length === 0) {
            registry.delete(key);
        }
        else {
            registry.set(key, remaining);
        }
    };
}
/** The registry key for an extension: itself if registered, else the fallback. */
export function previewKeyOf(ext) {
    return registry.has(ext.toLowerCase()) ? ext.toLowerCase() : FALLBACK_KEY;
}
/** The highest-priority entry for a key, or null when it has no entries. */
function highestPriority(key) {
    const entries = registry.get(key);
    if (!entries || entries.length === 0)
        return null;
    let best = entries[0];
    for (const entry of entries) {
        if (entry.priority >= best.priority)
            best = entry;
    }
    return best;
}
/** Resolve the preview component for an extension, falling back to 'binary'. */
export function resolvePreview(ext) {
    const key = previewKeyOf(ext);
    const entry = highestPriority(key) ?? highestPriority(FALLBACK_KEY);
    return entry.component;
}
