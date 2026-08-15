export type Translate = (key: string, params?: Record<string, unknown>) => string;
export declare const FILE_EXPLORER_NS = "file-explorer";
export declare const ZH: {
    readonly title: "文件浏览器";
    readonly file: "文件";
    readonly refresh: "刷新";
    readonly close: "关闭";
    readonly maximize: "最大化";
    readonly restore: "还原";
    readonly selectFile: "从文件树选择文件";
    readonly noSession: "当前没有打开的会话";
    readonly open: "打开";
    readonly openAsText: "打开为文本";
    readonly openAsBinary: "打开为二进制";
    readonly copyPath: "复制路径";
    readonly copyAbsolutePath: "复制绝对路径";
    readonly copyRelativePath: "复制相对路径";
    readonly emptyFile: "空文件";
    readonly binary: "无法预览此文件（二进制）";
    readonly tooLarge: "文件过大，无法预览";
};
export declare const EN: {
    readonly title: "File Explorer";
    readonly file: "Files";
    readonly refresh: "Refresh";
    readonly close: "Close";
    readonly maximize: "Maximize";
    readonly restore: "Restore";
    readonly selectFile: "Select a file from the tree";
    readonly noSession: "No open session";
    readonly open: "Open";
    readonly openAsText: "Open as text";
    readonly openAsBinary: "Open as binary";
    readonly copyPath: "Copy path";
    readonly copyAbsolutePath: "Copy absolute path";
    readonly copyRelativePath: "Copy relative path";
    readonly emptyFile: "Empty file";
    readonly binary: "Cannot preview binary file";
    readonly tooLarge: "File too large to preview";
};
/** Register the plugin's dictionaries; returns a disposer for both locales. */
export declare function registerFileExplorerLocale(ctx: {
    locale: {
        register(ns: string, locale: string, dict: Record<string, string>): () => void;
    };
}): () => void;
