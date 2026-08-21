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
    registerFileAction({ id: 'open-as-text', label: t => t('openAsText'), appliesTo: 'file', onSelect: (entry, h) => { h.openFileAsText(entry.path); } });
    registerFileAction({ id: 'open-as-binary', label: t => t('openAsBinary'), appliesTo: 'file', onSelect: (entry, h) => { h.openFileAsBinary(entry.path); } });
    registerFileAction({ id: 'copy-absolute', label: t => t('copyAbsolutePath'), appliesTo: 'both', onSelect: (entry, h) => { void h.copyAbsolutePath(entry.path); } });
    registerFileAction({ id: 'copy-relative', label: t => t('copyRelativePath'), appliesTo: 'both', onSelect: (entry, h) => { void h.copyRelativePath(entry.path); } });
    registerFileAction({ id: 'rename', label: t => t('rename'), appliesTo: 'both', onSelect: (entry, h) => { h.promptRename(entry); } });
    registerFileAction({ id: 'move', label: t => t('moveTo'), appliesTo: 'both', onSelect: (entry, h) => { h.promptMove(entry); } });
    registerFileAction({ id: 'copy', label: t => t('copyTo'), appliesTo: 'both', onSelect: (entry, h) => { h.promptCopy(entry); } });
    registerFileAction({ id: 'delete', label: t => t('delete'), appliesTo: 'both', danger: true, onSelect: (entry, h) => { h.promptDelete(entry); } });
    registerFileAction({ id: 'new-file', label: t => t('newFile'), appliesTo: 'directory', onSelect: (entry, h) => { h.promptNewFile(entry.path); } });
    registerFileAction({ id: 'new-folder', label: t => t('newFolder'), appliesTo: 'directory', onSelect: (entry, h) => { h.promptNewFolder(entry.path); } });
}
