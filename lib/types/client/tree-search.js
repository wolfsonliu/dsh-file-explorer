/** Case-insensitive substring match against an entry's name or workspace-relative path. */
export function matchesSearch(entry, query) {
    const q = query.trim().toLowerCase();
    if (q === '')
        return false;
    return entry.name.toLowerCase().includes(q) || entry.path.toLowerCase().includes(q);
}
/** Parent directory of a workspace-relative path ('' for root-level entries). */
export function parentPathOf(path) {
    const lastSlash = path.lastIndexOf('/');
    return lastSlash === -1 ? '' : path.slice(0, lastSlash);
}
