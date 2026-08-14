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
export function findSidebarTree(root) {
    return root.querySelector('[role="tree"]');
}
/**
 * Observes `document.body` for the sidebar tree and, once found, injects a
 * `<div data-fe-sidebar-host>` sibling after it and calls `onReady(host)`.
 *
 * Returns a disposer that disconnects the observer and removes the host.
 * If the tree never appears, `onReady` is never called (silent degrade).
 */
export function mountSidebar(onReady) {
    let host = null;
    let observer = null;
    function attach(tree) {
        if (host)
            return;
        host = document.createElement('div');
        host.dataset.feSidebarHost = '';
        const parent = tree.parentElement;
        if (parent)
            parent.appendChild(host);
        else
            tree.appendChild(host);
        observer?.disconnect();
        observer = null;
        onReady(host);
    }
    const existing = findSidebarTree(document.body);
    if (existing) {
        attach(existing);
    }
    else {
        observer = new MutationObserver(() => {
            const tree = findSidebarTree(document.body);
            if (tree)
                attach(tree);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
    return () => {
        observer?.disconnect();
        observer = null;
        host?.remove();
        host = null;
    };
}
