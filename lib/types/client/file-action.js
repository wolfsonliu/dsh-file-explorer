const actions = [];
let builtinsRegistered = false;
/** Register a file action (insertion order = menu order); returns a disposer. */
export function registerFileAction(action) {
    actions.push(action);
    return () => {
        const i = actions.indexOf(action);
        if (i >= 0)
            actions.splice(i, 1);
    };
}
/** Actions applicable to the given entry kind, in registration order. */
export function fileActionsFor(kind) {
    return actions.filter(a => a.appliesTo === kind || a.appliesTo === 'both');
}
/** Register the built-in file actions, in menu order (idempotent). */
export function registerBuiltinFileActions() {
    if (builtinsRegistered)
        return;
    builtinsRegistered = true;
    registerFileAction({ id: 'open', label: t => t('open'), appliesTo: 'file', onSelect: (entry, h) => { h.openFile(entry.path); } });
    registerFileAction({ id: 'copy-absolute', label: t => t('copyAbsolutePath'), appliesTo: 'both', onSelect: (entry, h) => { void h.copyAbsolutePath(entry.path); } });
    registerFileAction({ id: 'copy-relative', label: t => t('copyRelativePath'), appliesTo: 'both', onSelect: (entry, h) => { void h.copyRelativePath(entry.path); } });
}
