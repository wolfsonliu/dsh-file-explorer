export type Translate = (key: string, params?: Record<string, unknown>) => string
export const FILE_EXPLORER_NS = 'file-explorer'

export const ZH = {
  title: '文件浏览器', file: '文件', refresh: '刷新', close: '关闭',
  maximize: '最大化', restore: '还原',
  selectFile: '从文件树选择文件', noSession: '当前没有打开的会话',
  open: '打开', openAsText: '打开为文本', openAsBinary: '打开为二进制', copyPath: '复制路径', copyAbsolutePath: '复制绝对路径', copyRelativePath: '复制相对路径',
  emptyFile: '空文件', tooLarge: '文件过大，无法预览',
  hexTruncated: '文件较大，仅显示前 {shown} / {total}',
  loadMore: '加载更多', textLoaded: '已加载 {loaded} / {total}',
  edit: '编辑', save: '保存', cancel: '取消', mdPreview: '预览', saving: '保存中…', saveFailed: '保存失败',
  searchPlaceholder: '搜索文件…', noSearchResults: '没有匹配的文件', clearSearch: '清除搜索',
  new: '新建', newFile: '新建文件', newFolder: '新建文件夹',
  rename: '重命名', moveTo: '移动', copyTo: '复制', delete: '删除',
  confirmDelete: '确认删除 {name}？此操作不可恢复',
  create: '创建', moveHere: '移动到这里', copyHere: '复制到这里',
  selectDestination: '选择目标目录', workspaceRoot: '工作区根目录',
  confirm: '确定', opFailed: '操作失败',
} as const
export const EN = {
  title: 'File Explorer', file: 'Files', refresh: 'Refresh', close: 'Close',
  maximize: 'Maximize', restore: 'Restore',
  selectFile: 'Select a file from the tree', noSession: 'No open session',
  open: 'Open', openAsText: 'Open as text', openAsBinary: 'Open as binary', copyPath: 'Copy path', copyAbsolutePath: 'Copy absolute path', copyRelativePath: 'Copy relative path',
  emptyFile: 'Empty file', tooLarge: 'File too large to preview',
  hexTruncated: 'Showing first {shown} of {total}',
  loadMore: 'Load more', textLoaded: 'Loaded {loaded} / {total}',
  edit: 'Edit', save: 'Save', cancel: 'Cancel', mdPreview: 'Preview', saving: 'Saving…', saveFailed: 'Save failed',
  searchPlaceholder: 'Search files…', noSearchResults: 'No matching files', clearSearch: 'Clear search',
  new: 'New', newFile: 'New file', newFolder: 'New folder',
  rename: 'Rename', moveTo: 'Move', copyTo: 'Copy', delete: 'Delete',
  confirmDelete: 'Delete {name}? This cannot be undone',
  create: 'Create', moveHere: 'Move here', copyHere: 'Copy here',
  selectDestination: 'Select destination', workspaceRoot: 'Workspace root',
  confirm: 'OK', opFailed: 'Operation failed',
} as const

/** Register the plugin's dictionaries; returns a disposer for both locales. */
export function registerFileExplorerLocale(ctx: { locale: { register(ns: string, locale: string, dict: Record<string, string>): () => void } }): () => void {
  const d1 = ctx.locale.register(FILE_EXPLORER_NS, 'zh', ZH)
  const d2 = ctx.locale.register(FILE_EXPLORER_NS, 'en', EN)
  return () => { d1(); d2() }
}
