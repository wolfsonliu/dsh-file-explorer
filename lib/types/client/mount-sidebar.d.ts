/**
 * Finds the DSH sidebar anchor and injects a host container for the file
 * explorer overlay.
 *
 * The sidebar's session/workspace list is rendered by DSH as a `role="tree"`
 * element. That is a stable, semantic anchor — an external plugin cannot
 * modify DSH's sidebar source, so we locate it via the DOM and observe for
 * its appearance with a MutationObserver.
 */
/** Returns the sidebar's session-list element (`[role="tree"]`), or null. */
export declare function findSidebarTree(root: ParentNode): HTMLElement | null;
/**
 * Observes `document.body` for the sidebar tree and, once found, injects a
 * `<div data-fe-sidebar-host>` sibling after it and calls `onReady(host)`.
 *
 * Returns a disposer that disconnects the observer and removes the host.
 * If the tree never appears, `onReady` is never called (silent degrade).
 */
export declare function mountSidebar(onReady: (host: HTMLElement) => void): () => void;
