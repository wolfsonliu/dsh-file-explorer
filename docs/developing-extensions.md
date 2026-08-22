# Developing a dsh-file-explorer extension

[中文](developing-extensions.zh.md) | English

This guide covers everything you need to build a preview plugin (or "extension") for
[dsh-file-explorer](https://github.com/wolfsonliu/dsh-file-explorer). Three reference
implementations are available:

| Extension | What it previews | Key patterns |
|-----------|-----------------|--------------|
| [dsh-file-explorer-preview-code](https://github.com/wolfsonliu/dsh-file-explorer-preview-code) | Code files with syntax highlighting + editing | `writeFile`, text-only |
| [dsh-file-explorer-preview-molstar](https://github.com/wolfsonliu/dsh-file-explorer-preview-molstar) | Protein/small-molecule structures (`.cif`/`.pdb`/…) | `readRawFile`, large + binary files |
| [dsh-file-explorer-preview-sequence](https://github.com/wolfsonliu/dsh-file-explorer-preview-sequence) | DNA/RNA sequences (`.gb`/`.fasta`/…) | `readRawFile`, large + binary files |

## Architecture

```
dsh-file-explorer (core)
  └─ client apply: ctx.reflect.provide('fileExplorer', {
       registerPreview, registerFileAction, writeFile, readRawFile
     })

dsh-file-explorer-preview-<domain> (your extension)
  └─ inject: ['fileExplorer', 'locale']
  └─ apply: ctx.fileExplorer.registerPreview('ext', MyPreview, 10)
```

The core registers built-in previewers at priority `0` (text, markdown, image, CSV, binary).
Your extension registers at priority `10` to override them. Higher priority wins; equal
priority: later registration wins.

## The contract

Types come from the core package's `./client` export:

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
  /** Register a preview component for a file extension (lowercase, no dot). */
  registerPreview(ext: string, component: ComponentType<PreviewProps>, priority?: number): () => void

  /** Register a file-row action (appears in the row "···" menu). */
  registerFileAction(action: FileAction): () => void

  /** Write UTF-8 text to a workspace file. */
  writeFile(path: string, content: string): Promise<void>

  /**
   * Read raw bytes from a workspace file, with optional byte range.
   * @param path   Workspace-relative file path.
   * @param offset Byte offset (default 0).
   * @param limit  Max bytes to read (capped server-side by maxRawBytes, default 100 MiB).
   */
  readRawFile(path: string, offset?: number, limit?: number): Promise<ArrayBuffer>
}
```

### `PreviewProps` and `FilePreview`

```typescript
interface PreviewProps {
  preview: FilePreview
  filePath: string          // workspace-relative path
  t: Translate              // (key, params?) => string (bound to the file-explorer namespace)
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

### How routing works

`resolvePreviewFor(preview, ext)` decides which component renders a file:

```
preview.kind === 'image'   → your registered component, or ImagePreview (fallback)
preview.kind === 'empty'   → BinaryPreview (status page) — never overridden
preview.kind === 'text'    → your registered component, or TextPreview (fallback)
preview.kind === 'binary'  → your registered component, or BinaryPreview (fallback)
preview.kind === 'too-large' → your registered component, or BinaryPreview (fallback)
preview.kind === 'text-large' → your registered component, or the built-in paged text preview
```

The key change (dsh-file-explorer v0.1.0+): `too-large` and `binary` previews are now
**forwarded to registered extension components** instead of being hard-routed to the
status page. This means your extension can handle large files and binary formats by
calling `readRawFile`. `image` previews are likewise forwarded to your registered
component when one is registered for the file's extension; otherwise they fall back to
the built-in `ImagePreview`.

- If your extension is registered for extension `cif`, a `too-large` `.cif` file is
  routed to your component — you call `readRawFile` to get the bytes.
- If no extension is registered for `dat`, a `too-large` `.dat` file still falls back
  to the built-in status page ("File too large to preview").

## Minimal skeleton (read-only, text only)

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
  // props.preview.content is the file text — parse and render it.
  return renderStructure(props.preview.content)
}
```

Key points:

- **Service name** is `'fileExplorer'`. Inject it with `inject: ['fileExplorer']`.
- **Priority** — higher wins; built-ins use `0`, use `10` to override. Equal priority:
  later registration wins.
- **`registerPreview` returns a disposer** — call it in `ctx.effect` cleanup so
  HMR/unload removes the registration.
- **Register many extensions** in a loop, collecting all disposers.

## Handling large and binary files with `readRawFile`

For extensions that need to preview files larger than the core's 2 MiB text cap
(`maxTextBytes`), or binary formats that the core returns as `{ kind: 'binary' }`,
use `readRawFile`.

### Detecting `readRawFile` availability

`readRawFile` was added in dsh-file-explorer v0.1.0. Older versions of the core don't
have it, so your extension should probe and degrade gracefully:

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

### In the preview component

```typescript
type ReadRaw = (path: string, offset?: number, limit?: number) => Promise<ArrayBuffer>

function MyPreview({ preview, filePath, readRaw }: PreviewProps & { readRaw?: ReadRaw }) {
  const [data, setData] = useState<ArrayBuffer | null>(null)

  useEffect(() => {
    if (preview.kind === 'empty') return

    // Small text files: use preview.content directly
    if (preview.kind === 'text') {
      parseAndRender(preview.content)
      return
    }

    // Large or binary files: fetch raw bytes
    if (preview.kind === 'too-large' || preview.kind === 'binary') {
      if (!readRaw) {
        showError('File too large — upgrade dsh-file-explorer to preview this file')
        return
      }
      readRaw(filePath).then(setData).catch(handleError)
      return
    }
  }, [preview, filePath])
}
```

The molstar plugin's `MolstarPreview.tsx` is the reference implementation of this
pattern: it checks `preview.kind`, uses `content` for text, and calls `readRaw(filePath)`
for `too-large`/`binary`.

### Using byte ranges

For very large files you can read only the header/metadata first:

```typescript
// Read the first 4 KiB to inspect a file header
const header = await readRaw(filePath, 0, 4096)

// Read bytes 1 MiB to 2 MiB
const chunk = await readRaw(filePath, 1048576, 1048576)
```

The `limit` parameter is capped server-side by `maxRawBytes` (default 100 MiB).

## Editing with `writeFile`

Pass `writeFile` into your component via a factory closure:

```typescript
export function apply(ctx: { fileExplorer: FileExplorerService; ... }): void {
  ctx.effect(() => {
    const component = makeMyPreview(ctx.fileExplorer.writeFile, t)
    const disposers = EXTS.map(ext => ctx.fileExplorer.registerPreview(ext, component, 10))
    return () => { for (const d of disposers) d() }
  })
}
```

Inside the component, call `writeFile(filePath, content)` to save. The code plugin's
`CodePreview.tsx` is the reference: autosave 500ms after the last keystroke, plus
`Ctrl/Cmd+S` immediate save.

## Internationalization

Inject `locale` alongside `fileExplorer`, register your own `zh`/`en` dictionaries,
and bind a translator:

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

Note: `PreviewProps.t` is bound to the *file-explorer* namespace (`emptyFile`/`tooLarge`/
`hexTruncated`/…). Bind your own namespace for your own copy.

## CSS injection

External plugins can't import CSS modules. Inject styles via a `<style>` tag:

```typescript
export function apply(ctx: ClientContext): void {
  const styleEl = document.createElement('style')
  styleEl.setAttribute('data-my-preview-style', '')
  styleEl.textContent = MY_CSS
  document.head.appendChild(styleEl)

  ctx.effect(() => {
    // ... registrations ...
    return () => {
      // ... dispose registrations ...
      styleEl.remove()
    }
  })
}
```

## Adding a file-row action

```typescript
import type { FileAction } from '@dsh-external/dsh-file-explorer/client'

ctx.fileExplorer.registerFileAction({
  id: 'my-action',
  label: (t) => t('myAction'),
  appliesTo: 'both',
  onSelect: (entry, helpers) => {
    // entry: { name, path, kind }
    // helpers.openFile(path): opens a file in the preview box
    // helpers.promptRename(entry) / promptDelete(entry) / promptMove(entry) /
    //   promptCopy(entry): open the built-in rename/delete/move/copy dialogs
    // helpers.promptNewFile(parentDir) / promptNewFolder(parentDir): open the
    //   built-in new-file/new-folder dialogs for a directory
  },
})
```

## Bundling

Your extension is a client-only plugin. The host half (`src/index.ts`) is a minimal
no-op so the host Loader can import the roster entry.

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
  // Host half: minimal no-op
  entry: ['lib/types/index.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
}, {
  // Browser half: your client bundle
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

Key points:
- **`neverBundle`**: react, react-dom, and the DSH client runtime are provided by the
  platform — don't bundle them.
- **`alwaysBundle`**: everything else (your code, your dependencies, and any third-party
  libraries like molstar, codemirror, seqviz) must be inlined.
- **`codeSplitting: false`**: ensures dynamic `import()` calls are inlined into a single
  `client.js` file.
- **Banner/footer**: wraps your bundle in `window.__ModuleLoader__.load()` so the DSH
  runtime can register it.
- **Intro**: provides a minimal `module.exports` shim for CJS interop inside the bundle.

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

### `src/index.ts` (host half — no-op)

```typescript
export const inject: string[] = []
export function apply(): void {}
```

## Recommended project structure

```
src/
  index.ts              # host half: no-op apply()
  protocol.ts           # shared constants (extension list, plugin id)
  client/
    index.ts            # client apply: registrations, style/locale setup
    MyPreview.tsx        # your preview component
    locale.ts           # zh/en dictionaries
    styles.ts           # CSS string injected as <style> tag
tests/
  *.spec.ts             # vitest specs
lib/                    # built output (committed)
cordis.patch.yml        # roster insertion
tsdown.config.mjs       # bundle config
```

## Development workflow

```sh
npm install
npm run check     # tsc --noEmit
npm test          # vitest
npm run build     # tsc + tsdown → lib/
dsh plugin --profile web add .
dsh web
```

After `npm run build`, hard-refresh the browser (`Ctrl/Cmd+Shift+R`): `dsh web` may
serve a cached plugin bundle.

## Reference files

| What | Where |
|------|-------|
| `FileExplorerService` contract | `dsh-file-explorer` → `src/client/contract.ts` |
| Preview routing logic | `dsh-file-explorer` → `src/client/preview/index.ts` |
| Code plugin (text + editing) | `dsh-file-explorer-preview-code` → `src/client/index.ts`, `CodePreview.tsx` |
| Molstar plugin (large + binary) | `dsh-file-explorer-preview-molstar` → `src/client/index.ts`, `MolstarPreview.tsx` |
| Sequence plugin (large + binary) | `dsh-file-explorer-preview-sequence` → `src/client/index.ts`, `SequencePreview.tsx` |
| Bundle config template | `dsh-file-explorer-preview-molstar` → `tsdown.config.mjs` |