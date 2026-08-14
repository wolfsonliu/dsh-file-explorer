# dsh-file-explorer

[中文](README.zh.md) | English

A file explorer for DSH Web. A floating "Files" button opens a left drawer (workspace file tree); clicking a file floats a draggable/resizable preview box on the right. Clicking a "generated files" chip or a tool-row file link opens that file in the preview box instead of the OS default app.

## Features

1. **Floating entry**: an always-visible "Files" handle at the screen edge; click to toggle the file drawer.
2. **Left drawer**: a full-height fixed drawer with a title bar (refresh + close buttons) holding the workspace file tree.
3. **File browsing**: a lazy-loading directory tree that follows the current session's workspace root and refreshes on session switch.
4. **Floating preview**: clicking a file floats a draggable/resizable/minimizable/closable preview box on the right.
5. **Previewers**: built-in text (source), Markdown (rendered + source toggle), image (data URL), and binary (file info) previews.
6. **Extensible previews**: register previewers by extension through the `fileExplorer` service; unregistered extensions fall back to the `binary` preview. Add protein-structure (`.cif`/`.pdb` → Mol*), CSV, PDF, etc. previewers without touching the core.
7. **Context menu**: Open / Copy path / Copy relative path.
8. **Shortcut**: `Ctrl/Cmd+Shift+E` toggles the file drawer.

## Install

From a local checkout:

```sh
git clone <this-repo>
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

`dsh-file-explorer` exposes a preview-registration entry via the cordis service `fileExplorer`. Domain experts can ship a preview as a separate plugin (named `@dsh-external/dsh-file-explorer-preview-<domain>`) without touching the core.

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

## Development

```sh
npm install
npm run check     # tsc type check
npm test          # vitest unit tests
npm run build     # tsc + tsdown (host ESM + client CJS bundle)
```

## License

[MIT](LICENSE)
