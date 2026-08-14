# dsh-file-explorer

DSH Web 的浮动文件浏览器面板，在当前会话旁集中提供工作区文件浏览与预览。点击会话区"生成的文件"芯片或工具行文件链接，会自动在面板中打开对应文件预览，而非跳到系统默认应用。

## 功能

1. **文件浏览**：懒加载目录树，跟随当前会话的工作区根目录，切换会话时自动刷新。
2. **文件预览**：内置文本（源码）、Markdown（渲染 + 源码切换）、图片（data URL）、二进制（文件信息）预览。
3. **可扩展预览注册表**：`registerPreview(ext, component)` 按文件扩展名注册预览组件，未注册的扩展名回退到 `binary` 预览。新增蛋白质结构（`.cif`/`.pdb` → Mol*）、CSV、PDF 等预览器无需改动面板本身。
4. **右键菜单**：打开 / 复制路径 / 复制相对路径。
5. **快捷键**：`Ctrl/Cmd+Shift+E` 开关面板。

## 安装

从本地目录安装：

```sh
git clone <this-repo>
cd dsh-file-explorer
npm install
npm run build
dsh plugin --profile web add .
dsh web
```

或安装后直接 `dsh web` 查看。

## 配置

组合包默认启用以下配置：

```yaml
- insert:
    - id: file-explorer
      name: '@dsh-external/dsh-file-explorer'
      config:
        maxTextBytes: 2097152
        maxImageBytes: 10485760
```

| 配置项          | 默认值 | 说明                               |
| --------------- | -----: | ---------------------------------- |
| `maxTextBytes`  |  2 MiB | 可预览的单个文本文件大小上限       |
| `maxImageBytes` | 10 MiB | 可预览的单个图片大小上限           |

## 数据层

宿主半部通过 `ctx.webServer.register()` 注册一个 `/file-explorer/api` 精确路由，动作（`action` 查询参数）：

- `list`：列出一级目录（目录在前、按名称排序），返回 `BrowserEntry[]`。
- `preview`：读取单个文件，返回判别式 `FilePreview`（`text` / `image` / `empty` / `binary` / `too-large`）。
- `resolve-path`：解析工作区相对路径为绝对路径与父路径。

所有路径经 `inside(root, input)` 工作区包含校验（含 `realpath` 符号链接解析），越界路径一律拒绝。文本/二进制通过 NUL 字节扫描判别，图片按扩展名映射 MIME 并返回 data URL。

## Model Experience

本插件为纯 UI 表面，**不产生任何会话事件、不改动会话日志**，对模型不可见。宿主半部仅读取文件内容用于浏览器预览，与 agent 工具执行互不影响。

## Known Limitations and Deferred Work

- **仅预览，无编辑**：文本编辑（CodeMirror 6）与自动保存属于后续阶段。
- **单文件预览**：无多标签页、无行内 diff。
- **不轮询刷新**：目录树仅手动刷新（↻），切换会话时自动刷新。
- **隐藏目录**：跳过 `.git` 与 `node_modules`；不提供显示隐藏文件的开关。
- **文件链接拦截为 best-effort**：依赖 DSH 会话区的 CSS 类名（`_fileLink`、`data-produced-files-row`），上游 UI 结构调整时需同步选择器。
- **大文件**：整文件读取受 `maxTextBytes`/`maxImageBytes` 上限约束，流式读取未实现。

## 开发

```sh
npm install
npm run check     # tsc 类型检查
npm test          # vitest 单元测试
npm run build     # tsc + tsdown（宿主 ESM + 客户端 CJS bundle）
```

## 许可

[MIT](LICENSE)
