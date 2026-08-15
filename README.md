# dsh-file-explorer

[中文](README.zh.md) | English

A file explorer for DSH Web. A floating "Files" button opens a left drawer (workspace file tree); clicking a file floats a draggable/resizable preview box on the right. Clicking a "generated files" chip or a tool-row file link opens that file in the preview box instead of the OS default app.

## Screenshots

| Light | Dark |
| ----- | ---- |
| ![File explorer (light theme)](./assets/dsh-file-explorer_light.png) | ![File explorer (dark theme)](./assets/dsh-file-explorer_dark.png) |

## Features

1. **Floating entry**: an always-visible "Files" handle at the screen edge; click to toggle the file drawer.
2. **Left drawer**: a full-height fixed drawer with a title bar (refresh + close buttons) holding the workspace file tree.
3. **File browsing**: a lazy-loading directory tree that follows the current session's workspace root and refreshes on session switch.
4. **Floating preview**: clicking a file floats a draggable/resizable/minimizable/closable preview box on the right.
5. **Previewers**: built-in text (source), Markdown (rendered + source toggle), image (data URL), and binary (file info) previews.
6. **Extensible previews**: register previewers by extension through the `fileExplorer` service; unregistered extensions fall back to the `binary` preview. Add protein-structure (`.cif`/`.pdb` → Mol*), CSV, PDF, etc. previewers without touching the core.
7. **Row actions menu**: hover a file/directory row to reveal a "···" menu (Open / Copy absolute path / Copy relative path).
8. **Shortcut**: `Ctrl/Cmd+Shift+E` toggles the file drawer.

## Install

From the git repository (recommended):

```sh
dsh plugin --profile web add github:wolfsonliu/dsh-file-explorer
dsh web
```

Or from a local checkout:

```sh
git clone https://github.com/wolfsonliu/dsh-file-explorer
cd dsh-file-explorer
npm install
npm run build
dsh plugin --profile web add .
dsh web
```

## Configuration

The bundle enables the following defaults:

```yaml
- insert:
    - id: file-explorer
      name: '@dsh-external/dsh-file-explorer'
      config:
        maxTextBytes: 2097152
        maxImageBytes: 10485760
```

| Config          | Default | Description                                 |
| --------------- | ------: | ------------------------------------------- |
| `maxTextBytes`  |   2 MiB | Max size of a single text file to preview   |
| `maxImageBytes` |  10 MiB | Max size of a single image file to preview  |

## Data layer

The host half registers a `/file-explorer/api` exact route via `ctx.webServer.register()`. Actions (`action` query param):

- `list`: lists one directory level (directories first, by name), returning `BrowserEntry[]`.
- `preview`: reads one file, returning a discriminated `FilePreview` (`text` / `image` / `empty` / `binary` / `too-large`).
- `resolve-path`: resolves a workspace-relative path to an absolute path and parent path.
- `write`: writes UTF-8 text to a workspace file (POST body `{ path, content }`), returning the saved relative path.

All paths pass a workspace-containment check (`inside(root, input)`, including `realpath` symlink resolution); out-of-workspace paths are rejected. Text/binary is detected by a NUL-byte scan; images map extensions to MIME and return a data URL.

## Model Experience

This plugin is a pure UI surface — it emits no session events and does not modify session logs, so it is invisible to the model. The host half only reads file content for browser preview, independent of agent tool execution.

## Known Limitations and Deferred Work

- **Preview only, no editing**: text editing (CodeMirror 6) and autosave are a later phase.
- **Single-file preview**: no multi-tab or inline diff.
- **No polling refresh**: the tree only refreshes manually (↻) or on session switch.
- **File-link interception is best-effort**: it relies on DSH's CSS class names (`_fileLink`, `data-produced-files-row`); update the selectors if the upstream UI changes.
- **Large files**: whole-file reads are bounded by `maxTextBytes`/`maxImageBytes`; streaming is not implemented.

## Developing preview plugins

`dsh-file-explorer` exposes registration entries via the cordis service `fileExplorer`: `registerPreview` (add a previewer), `registerFileAction` (add a file-row menu item), and `writeFile` (write UTF-8 text back to a workspace file). Domain experts can ship extensions as separate plugins (named `@dsh-external/dsh-file-explorer-preview-<domain>`) without touching the core.

```typescript
// preview plugin client entry
import type { PreviewProps } from '@dsh-external/dsh-file-explorer/client'

export const inject = ['fileExplorer']

export function apply(ctx: {
  fileExplorer: { registerPreview(ext: string, comp: React.ComponentType<PreviewProps>, priority?: number): () => void }
  effect(cb: () => (() => void), label?: string): void
}): void {
  ctx.effect(() => ctx.fileExplorer.registerPreview('cif', CifPreview, 10))
}

function CifPreview(props: PreviewProps) {
  // when props.preview.kind === 'text', props.preview.content is the file text
  return renderStructure(props.preview.content)
}
```

Notes:

- **Service name**: `fileExplorer`. Inject it with `inject: ['fileExplorer']`, then call `ctx.fileExplorer.registerPreview(ext, component, priority?)`.
- **Priority**: higher wins; built-ins use `0`, use `10` to override. Later registration wins on ties.
- **Contract types**: `import type { PreviewProps } from '@dsh-external/dsh-file-explorer/client'`.
- **registerPreview returns a disposer**: call it in `ctx.effect` cleanup to unregister on unload/HMR.

## Extensions

`dsh-file-explorer` is designed for extension through the `fileExplorer` service. Known extensions:

| Extension | Description | Repository |
| --------- | ----------- | ---------- |
| `dsh-file-explorer-preview-code` | CodeMirror 6 code preview with editing | [wolfsonliu/dsh-file-explorer-preview-code](https://github.com/wolfsonliu/dsh-file-explorer-preview-code) |
| `dsh-file-explorer-preview-molstar` | Mol* molecular-structure preview (`.cif` / `.pdb`) | [wolfsonliu/dsh-file-explorer-preview-molstar](https://github.com/wolfsonliu/dsh-file-explorer-preview-molstar) |

More extensions are welcome — build your own by following [Developing preview plugins](#developing-preview-plugins).

## Development

```sh
npm install
npm run check     # tsc type check
npm test          # vitest unit tests
npm run build     # tsc + tsdown (host ESM + client CJS bundle)
```

## References

- [dsh-side-panel](https://github.com/ccq1/dsh-side-panel) — a DSH Web side panel plugin; the architectural reference for this project's host route and file-link interception.
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — the DSH framework this plugin extends.

## License

[MIT](LICENSE)
