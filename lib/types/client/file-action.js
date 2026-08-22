import { jsx as _jsx } from "react/jsx-runtime";
import { IconBrowse, IconCode, IconCopy, IconEdit, IconFolderOpen, IconListPen, IconMove, IconPlus, IconTrash } from "./icons.js";
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
    registerFileAction({ id: 'open', label: t => t('open'), icon: _jsx(IconBrowse, {}), appliesTo: 'file', onSelect: (entry, h) => { h.openFile(entry.path); } });
    registerFileAction({ id: 'open-as-text', label: t => t('openAsText'), icon: _jsx(IconListPen, {}), appliesTo: 'file', onSelect: (entry, h) => { h.openFileAsText(entry.path); } });
    registerFileAction({ id: 'open-as-binary', label: t => t('openAsBinary'), icon: _jsx(IconCode, {}), appliesTo: 'file', onSelect: (entry, h) => { h.openFileAsBinary(entry.path); } });
    registerFileAction({ id: 'copy-absolute', label: t => t('copyAbsolutePath'), icon: _jsx(IconCopy, {}), appliesTo: 'both', onSelect: (entry, h) => { void h.copyAbsolutePath(entry.path); } });
    registerFileAction({ id: 'copy-relative', label: t => t('copyRelativePath'), icon: _jsx(IconCopy, {}), appliesTo: 'both', onSelect: (entry, h) => { void h.copyRelativePath(entry.path); } });
    registerFileAction({ id: 'rename', label: t => t('rename'), icon: _jsx(IconEdit, {}), appliesTo: 'both', onSelect: (entry, h) => { h.promptRename(entry); } });
    registerFileAction({ id: 'move', label: t => t('moveTo'), icon: _jsx(IconMove, {}), appliesTo: 'both', onSelect: (entry, h) => { h.promptMove(entry); } });
    registerFileAction({ id: 'copy', label: t => t('copyTo'), icon: _jsx(IconCopy, {}), appliesTo: 'both', onSelect: (entry, h) => { h.promptCopy(entry); } });
    registerFileAction({ id: 'delete', label: t => t('delete'), icon: _jsx(IconTrash, {}), danger: true, appliesTo: 'both', onSelect: (entry, h) => { h.promptDelete(entry); } });
    registerFileAction({ id: 'new-file', label: t => t('newFile'), icon: _jsx(IconPlus, {}), appliesTo: 'directory', onSelect: (entry, h) => { h.promptNewFile(entry.path); } });
    registerFileAction({ id: 'new-folder', label: t => t('newFolder'), icon: _jsx(IconFolderOpen, {}), appliesTo: 'directory', onSelect: (entry, h) => { h.promptNewFolder(entry.path); } });
}
