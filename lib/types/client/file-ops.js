/** Join a parent directory path ('' = root) with a single name segment. */
export function joinRel(parentDir, name) {
    return parentDir === '' ? name : `${parentDir}/${name}`;
}
/** The final path segment of a workspace-relative path. */
export function basenameOfRel(path) {
    return path.split('/').at(-1) ?? path;
}
