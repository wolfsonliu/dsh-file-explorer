export const FILE_EXPLORER_NS = 'file-explorer';
export const ZH = {
    title: '文件浏览器', file: '文件', refresh: '刷新', close: '关闭',
    maximize: '最大化', restore: '还原',
    selectFile: '从文件树选择文件', noSession: '当前没有打开的会话',
    open: '打开', openAsText: '打开为文本', openAsBinary: '打开为二进制', copyPath: '复制路径', copyAbsolutePath: '复制绝对路径', copyRelativePath: '复制相对路径',
    emptyFile: '空文件', binary: '无法预览此文件（二进制）', tooLarge: '文件过大，无法预览',
};
export const EN = {
    title: 'File Explorer', file: 'Files', refresh: 'Refresh', close: 'Close',
    maximize: 'Maximize', restore: 'Restore',
    selectFile: 'Select a file from the tree', noSession: 'No open session',
    open: 'Open', openAsText: 'Open as text', openAsBinary: 'Open as binary', copyPath: 'Copy path', copyAbsolutePath: 'Copy absolute path', copyRelativePath: 'Copy relative path',
    emptyFile: 'Empty file', binary: 'Cannot preview binary file', tooLarge: 'File too large to preview',
};
/** Register the plugin's dictionaries; returns a disposer for both locales. */
export function registerFileExplorerLocale(ctx) {
    const d1 = ctx.locale.register(FILE_EXPLORER_NS, 'zh', ZH);
    const d2 = ctx.locale.register(FILE_EXPLORER_NS, 'en', EN);
    return () => { d1(); d2(); };
}
