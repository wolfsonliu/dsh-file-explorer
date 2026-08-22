# 开发 dsh-file-explorer 扩展

[English](developing-extensions.md) | 中文

本文档涵盖为 [dsh-file-explorer](https://github.com/wolfsonliu/dsh-file-explorer) 开发预览插件（即"扩展"）所需的一切。可参考以下三个实现：

| 扩展 | 预览内容 | 关键模式 |
|------|---------|----------|
| [dsh-file-explorer-preview-code](https://github.com/wolfsonliu/dsh-file-explorer-preview-code) | 代码文件（语法高亮 + 编辑） | `writeFile`，纯文本 |
| [dsh-file-explorer-preview-molstar](https://github.com/wolfsonliu/dsh-file-explorer-preview-molstar) | 蛋白质/小分子结构（`.cif`/`.pdb`/…） | `readRawFile`，大文件 + 二进制 |
| [dsh-file-explorer-preview-sequence](https://github.com/wolfsonliu/dsh-file-explorer-preview-sequence) | DNA/RNA 序列（`.gb`/`.fasta`/…） | `readRawFile`，大文件 + 二进制 |

## 架构

```
dsh-file-explorer（核心）
  └─ 客户端 apply：ctx.reflect.provide('fileExplorer', {
       registerPreview, registerFileAction, writeFile, readRawFile
     })

dsh-file-explorer-preview-<domain>（你的扩展）
  └─ inject: ['fileExplorer', 'locale']
  └─ apply：ctx.fileExplorer.registerPreview('ext', MyPreview, 10)
```

核心以优先级 `0` 注册内置预览器（文本、Markdown、图片、CSV、二进制）。你的扩展以优先级
`10` 注册来覆盖它们。优先级数值越大越优先；同优先级时后注册者胜。

## 契约

类型来自核心包的 `./client` 导出：

```typescript
import type {
  FileExplorerService,
  PreviewProps,
  FileAction,
  FileActionHelpers,
  Translate,
} from '@dsh-external/dsh-file-explorer/client'
```

### `FileExplorerService`

```typescript
interface FileExplorerService {
  /** 为文件扩展名注册预览组件（小写，无前导点）。 */
  registerPreview(ext: string, component: ComponentType<PreviewProps>, priority?: number): () => void

  /** 注册文件行操作（出现在行末尾「···」菜单中）。 */
  registerFileAction(action: FileAction): () => void

  /** 将 UTF-8 文本写入工作区文件。 */
  writeFile(path: string, content: string): Promise<void>

  /**
   * 从工作区文件读取原始字节，可选字节范围。
   * @param path   工作区相对路径。
   * @param offset 起始字节偏移（默认 0）。
   * @param limit  最大读取字节数（服务端由 maxRawBytes 限制，默认 100 MiB）。
   */
  readRawFile(path: string, offset?: number, limit?: number): Promise<ArrayBuffer>
}
```

### `PreviewProps` 和 `FilePreview`

```typescript
interface PreviewProps {
  preview: FilePreview
  filePath: string          // 工作区相对路径
  t: Translate              // (key, params?) => string（绑定在 file-explorer 命名空间）
  activeView: 'preview' | 'source'
  onViewSource?: () => void
}

type FilePreview =
  | { kind: 'text'; name: string; extension: string; content: string; size: number }
  | { kind: 'image'; name: string; mime: string; dataUrl: string; size: number }
  | { kind: 'empty'; name: string; size: 0 }
  | { kind: 'binary'; name: string; size: number; bytes: string; truncated: boolean }
  | { kind: 'text-large'; name: string; extension: string; size: number }
  | { kind: 'too-large'; name: string; size: number }
```

### 路由规则

`resolvePreviewFor(preview, ext)` 决定哪个组件渲染文件：

```
preview.kind === 'image'      → 你注册的组件，或 ImagePreview（回退）
preview.kind === 'empty'      → BinaryPreview（状态页）——永不覆盖
preview.kind === 'text'       → 你注册的组件，或 TextPreview（回退）
preview.kind === 'binary'     → 你注册的组件，或 BinaryPreview（回退）
preview.kind === 'too-large'  → 你注册的组件，或 BinaryPreview（回退）
preview.kind === 'text-large' → 你注册的组件，或内置的分页文本预览
```

关键变化（dsh-file-explorer v0.1.0+）：`too-large` 和 `binary` 类型的预览现在会
**转发到已注册的扩展组件**，而非硬路由到状态页。这意味着你的扩展可以通过调用
`readRawFile` 来处理大文件和二进制格式。`image` 类型的预览同样会转发到为该扩展名
注册的组件；未注册时回退到内置 `ImagePreview`。

- 如果你为扩展名 `cif` 注册了预览组件，一个 `too-large` 的 `.cif` 文件会被路由到
  你的组件——你调用 `readRawFile` 获取字节。
- 如果没有为 `dat` 注册任何扩展，一个 `too-large` 的 `.dat` 文件仍会回退到内置
  状态页（"文件过大，无法预览"）。

## 最小骨架（只读，纯文本）

```typescript
// src/client/index.ts
import type { ComponentType } from 'react'
import type { PreviewProps } from '@dsh-external/dsh-file-explorer/client'

export const inject = ['fileExplorer']

export function apply(ctx: {
  fileExplorer: { registerPreview(ext: string, comp: ComponentType<PreviewProps>, priority?: number): () => void }
  effect(cb: () => (() => void), label?: string): void
}): void {
  ctx.effect(() => {
    const dispose = ctx.fileExplorer.registerPreview('cif', CifPreview, 10)
    return () => dispose()
  }, 'my-preview: client')
}

function CifPreview(props: PreviewProps) {
  if (props.preview.kind !== 'text') return null
  // props.preview.content 即文件文本——解析并渲染。
  return renderStructure(props.preview.content)
}
```

要点：

- **服务名**为 `'fileExplorer'`，用 `inject: ['fileExplorer']` 注入。
- **优先级**：数值越大越优先；内置为 `0`，用 `10` 覆盖。同优先级后注册者胜。
- **`registerPreview` 返回 disposer**——在 `ctx.effect` 清理中调用，以便 HMR/卸载时
  移除注册。
- **循环注册多个扩展名**，收集所有 disposer。

## 处理大文件和二进制文件（`readRawFile`）

对于需要预览超过核心 2 MiB 文本上限（`maxTextBytes`）的文件，或核心返回
`{ kind: 'binary' }` 的二进制格式，请使用 `readRawFile`。

### 检测 `readRawFile` 是否可用

`readRawFile` 在 dsh-file-explorer v0.1.0 中加入。旧版本核心没有此方法，因此你的
扩展应探测并优雅降级：

```typescript
import type { FileExplorerService } from '@dsh-external/dsh-file-explorer/client'

type MyFileExplorer = FileExplorerService & {
  readRawFile?: (path: string, offset?: number, limit?: number) => Promise<ArrayBuffer>
}

export function apply(ctx: { fileExplorer: MyFileExplorer; ... }): void {
  ctx.effect(() => {
    const readRaw = typeof ctx.fileExplorer.readRawFile === 'function'
      ? ctx.fileExplorer.readRawFile
      : undefined

    const component = makeMyPreview(readRaw, t)
    const disposers = EXTS.map(ext => ctx.fileExplorer.registerPreview(ext, component, 10))
    return () => { for (const d of disposers) d() }
  })
}
```

### 在预览组件中使用

```typescript
type ReadRaw = (path: string, offset?: number, limit?: number) => Promise<ArrayBuffer>

function MyPreview({ preview, filePath, readRaw }: PreviewProps & { readRaw?: ReadRaw }) {
  const [data, setData] = useState<ArrayBuffer | null>(null)

  useEffect(() => {
    if (preview.kind === 'empty') return

    // 小文本文件：直接使用 preview.content
    if (preview.kind === 'text') {
      parseAndRender(preview.content)
      return
    }

    // 大文件或二进制文件：获取原始字节
    if (preview.kind === 'too-large' || preview.kind === 'binary') {
      if (!readRaw) {
        showError('文件过大——请升级 dsh-file-explorer 以预览此文件')
        return
      }
      readRaw(filePath).then(setData).catch(handleError)
      return
    }
  }, [preview, filePath])
}
```

molstar 插件的 `MolstarPreview.tsx` 是此模式的参考实现：它检查 `preview.kind`，对
文本使用 `content`，对 `too-large`/`binary` 调用 `readRaw(filePath)`。

### 使用字节范围

对于非常大的文件，可以先只读取头部/元数据：

```typescript
// 读取前 4 KiB 检查文件头
const header = await readRaw(filePath, 0, 4096)

// 读取第 1 MiB 到第 2 MiB
const chunk = await readRaw(filePath, 1048576, 1048576)
```

`limit` 参数在服务端受 `maxRawBytes` 限制（默认 100 MiB）。

## 带保存的编辑（`writeFile`）

通过工厂闭包将 `writeFile` 传入组件：

```typescript
export function apply(ctx: { fileExplorer: FileExplorerService; ... }): void {
  ctx.effect(() => {
    const component = makeMyPreview(ctx.fileExplorer.writeFile, t)
    const disposers = EXTS.map(ext => ctx.fileExplorer.registerPreview(ext, component, 10))
    return () => { for (const d of disposers) d() }
  })
}
```

在组件中调用 `writeFile(filePath, content)` 进行保存。code 插件的
`CodePreview.tsx` 是参考实现：末次按键 500ms 后自动保存，加 `Ctrl/Cmd+S` 立即保存。

## 国际化

在 `fileExplorer` 之外再注入 `locale`，用自己的命名空间注册 `zh`/`en` 字典，并绑定
翻译器：

```typescript
export const inject = ['fileExplorer', 'locale']

export function apply(ctx: {
  fileExplorer: FileExplorerService
  locale: {
    register(ns: string, locale: string, dict: Record<string, string>): () => void
    bind(ns: string): Translate
  }
  effect(cb: () => (() => void), label?: string): void
}): void {
  ctx.effect(() => {
    const d1 = ctx.locale.register('my-preview', 'zh', { hello: '你好' })
    const d2 = ctx.locale.register('my-preview', 'en', { hello: 'Hello' })
    const t = ctx.locale.bind('my-preview')
    const component = makeMyPreview(t)
    const disposers = EXTS.map(ext => ctx.fileExplorer.registerPreview(ext, component, 10))
    return () => {
      for (const d of disposers) d()
      d1(); d2()
    }
  })
}
```

注意：`PreviewProps.t` 绑定在 *file-explorer* 命名空间（`emptyFile`/`tooLarge`/
`hexTruncated`/…）。请为自己的文案绑定自己的命名空间。

## CSS 注入

外部插件无法导入 CSS 模块。通过 `<style>` 标签注入样式：

```typescript
export function apply(ctx: ClientContext): void {
  const styleEl = document.createElement('style')
  styleEl.setAttribute('data-my-preview-style', '')
  styleEl.textContent = MY_CSS
  document.head.appendChild(styleEl)

  ctx.effect(() => {
    // ... 注册 ...
    return () => {
      // ... 清理注册 ...
      styleEl.remove()
    }
  })
}
```

## 添加文件行操作

```typescript
import type { FileAction } from '@dsh-external/dsh-file-explorer/client'

ctx.fileExplorer.registerFileAction({
  id: 'my-action',
  label: (t) => t('myAction'),
  appliesTo: 'both',
  onSelect: (entry, helpers) => {
    // entry: { name, path, kind }
    // helpers.openFile(path)：在预览框中打开文件
    // helpers.promptRename(entry) / promptDelete(entry) / promptMove(entry) /
    //   promptCopy(entry)：打开内置的重命名/删除/移动/复制对话框
    // helpers.promptNewFile(parentDir) / promptNewFolder(parentDir)：打开内置的
    //   新建文件/新建文件夹对话框
  },
})
```

## 打包

你的扩展是纯客户端插件。宿主半部（`src/index.ts`）是一个最小 no-op，以便宿主
Loader 能导入该 roster 条目。

### `tsdown.config.mjs`

```javascript
const id = '@dsh-external/dsh-file-explorer-preview-<domain>'
const platformModules = [
  '@deepseek-ai/dsh-client-runtime/client',
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
]

export default [{
  // 宿主半部：最小 no-op
  entry: ['lib/types/index.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
}, {
  // 浏览器半部：你的客户端 bundle
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  dts: false,
  sourcemap: true,
  clean: false,
  deps: {
    neverBundle: platformModules,
    alwaysBundle: mod => platformModules.includes(mod) ? undefined : true,
    onlyBundle: false,
  },
  outputOptions: {
    entryFileNames: 'client.js',
    codeSplitting: false,
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} };\nvar exports = module.exports;',
  },
}]
```

要点：
- **`neverBundle`**：react、react-dom 和 DSH 客户端运行时由平台提供——不要打包。
- **`alwaysBundle`**：其余一切（你的代码、依赖和第三方库如 molstar、codemirror、
  seqviz）必须内联。
- **`codeSplitting: false`**：确保动态 `import()` 调用内联到单个 `client.js` 文件中。
- **Banner/footer**：将你的 bundle 包装在 `window.__ModuleLoader__.load()` 中，以便
  DSH 运行时注册。
- **Intro**：提供最小 `module.exports` 垫片，供 bundle 内部 CJS 互操作。

### `package.json`

```json
{
  "name": "@dsh-external/dsh-file-explorer-preview-<domain>",
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-runtime"] }
  }
}
```

### `cordis.patch.yml`

```yaml
- insert:
    - id: my-preview
      name: '@dsh-external/dsh-file-explorer-preview-<domain>'
```

### `src/index.ts`（宿主半部 — no-op）

```typescript
export const inject: string[] = []
export function apply(): void {}
```

## 推荐项目结构

```
src/
  index.ts              # 宿主半部：no-op apply()
  protocol.ts           # 共享常量（扩展名列表、插件 ID）
  client/
    index.ts            # 客户端 apply：注册、样式/locale 装配
    MyPreview.tsx        # 你的预览组件
    locale.ts           # 中英文词典
    styles.ts           # 以 <style> 标签注入的 CSS 字符串
tests/
  *.spec.ts             # vitest 测试
lib/                    # 构建产物（已提交）
cordis.patch.yml        # roster 插入
tsdown.config.mjs       # bundle 配置
```

## 开发流程

```sh
npm install
npm run check     # tsc --noEmit
npm test          # vitest
npm run build     # tsc + tsdown → lib/
dsh plugin --profile web add .
dsh web
```

`npm run build` 后请硬刷新浏览器（`Ctrl/Cmd+Shift+R`）：`dsh web` 可能缓存旧版插件
bundle。

## 参考文件

| 内容 | 位置 |
|------|------|
| `FileExplorerService` 契约 | `dsh-file-explorer` → `src/client/contract.ts` |
| 预览路由逻辑 | `dsh-file-explorer` → `src/client/preview/index.ts` |
| Code 插件（文本 + 编辑） | `dsh-file-explorer-preview-code` → `src/client/index.ts`、`CodePreview.tsx` |
| Molstar 插件（大文件 + 二进制） | `dsh-file-explorer-preview-molstar` → `src/client/index.ts`、`MolstarPreview.tsx` |
| Sequence 插件（大文件 + 二进制） | `dsh-file-explorer-preview-sequence` → `src/client/index.ts`、`SequencePreview.tsx` |
| Bundle 配置模板 | `dsh-file-explorer-preview-molstar` → `tsdown.config.mjs` |