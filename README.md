# dsh-file-explorer

[中文](README.zh.md) | English

A file explorer for DSH Web. A floating "Files" button opens a left drawer (workspace file tree); clicking a file floats a draggable/resizable preview box on the right. Clicking a "generated files" chip or a tool-row file link opens that file in the preview box instead of the OS default app.

## Screenshots

| Light | Dark |
| ----- | ---- |
| ![File explorer (light theme)](./assets/dsh-file-explorer_light.png) | ![File explorer (dark theme)](./assets/dsh-file-explorer_dark.png) |

## Features

1. **Floating entry**: a "Files" button pinned to the left edge of the page. It stays collapsed into a small, low-profile handle — intentionally unobtrusive and out of the way — so it does not distract from the main workspace. Hover or click to expand it and toggle the file drawer.
2. **Left drawer**: a full-height fixed drawer with a title bar (refresh + close buttons) holding the workspace file tree.
3. **File browsing**: a lazy-loading directory tree that follows the current session's workspace root and refreshes on session switch; a search box at the top filters already-loaded entries by name or path, and a sort selector reorders them by name / size / modified time (ascending or descending).
4. **Floating preview**: clicking a file floats a draggable/resizable/minimizable/closable preview box on the right.
5. **Previewers**: built-in text (source), Markdown (rendered + source toggle + inline edit), image (data URL, including SVG), CSV (read-only table), and binary (hexdump) previews.
6. **Extensible previews**: register previewers by extension through the `fileExplorer` service; unregistered extensions fall back to the `binary` preview, and a higher-priority registration **overrides** the built-in preview for that extension. Add protein-structure (`.cif`/`.pdb` → Mol*), sequence, etc. previewers without touching the core.
7. **Open in the browser**: clicking a `.pdf` / `.html` / `.htm` / `.xhtml` / `.json` file opens it in a new browser tab with the browser's native renderer; HTML pages load their same-directory assets (CSS/JS/images/fonts).
8. **Row actions menu**: hover a row to reveal a "···" menu. File rows offer Open (or Open as text / Open as binary) and Copy absolute / relative path; both file and directory rows offer Rename, Move, Copy, and Delete, while directory rows add New file / New folder. A "＋ New" button in the drawer title bar creates a file or folder at the workspace root.
9. **Shortcut**: `Ctrl/Cmd+Shift+E` toggles the file drawer.

## Preview behavior by file type

How a file opens depends on its extension and on how its bytes are detected
(text vs binary):

| Type | Extension(s) | Default behavior |
| ---- | ------------ | ---------------- |
| Source text | `.ts` `.tsx` `.js` `.jsx` `.css` `.py` `.yaml` `.yml` `.sh` `.go` `.rs` `.xml` `.sql` `.txt` … | Plain source preview; large files stream page by page |
| Markdown | `.md` `.mdx` | Rendered HTML, with a source toggle and inline edit |
| Image | `.png` `.jpg` `.jpeg` `.gif` `.webp` `.svg` | Image preview (data URL) |
| CSV | `.csv` | Read-only table (first row is the header) |
| PDF | `.pdf` | Browser's native viewer, new tab |
| HTML | `.html` `.htm` `.xhtml` | Browser's native renderer, new tab |
| JSON | `.json` | Browser's native viewer, new tab |
| Binary / unregistered | — | Hexdump (`hexdump -C` style, first `maxBinaryBytes`) |

Text versus binary is decided by a NUL-byte scan; images are recognized by
extension. Empty files show a status note, and files past their size cap show
"File too large" (text pages instead of failing). Any file can also be
force-opened as text or as binary from its "···" row menu, bypassing the
default above.

### Overriding built-in previewers

Built-in previewers register at priority `0`. Because `registerPreview(ext,
component, priority)` resolves the highest priority first, an extension can
replace any built-in preview for a specific extension — for example a richer
Markdown or CSV renderer — without touching the core.

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

### Optional preview plugins

Install additional previewers for richer file previews:

```sh
# CodeMirror 6 code preview with syntax highlighting and editing
dsh plugin --profile web add github:wolfsonliu/dsh-file-explorer-preview-code

# Mol* molecular-structure preview (.cif / .pdb)
dsh plugin --profile web add github:wolfsonliu/dsh-file-explorer-preview-molstar

# SeqViz sequence viewer (FASTA / GenBank / JBEI / SnapGene / SBOL)
dsh plugin --profile web add github:wolfsonliu/dsh-file-explorer-preview-sequence
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
        maxBinaryBytes: 65536
        maxRawBytes: 104857600
        showHidden: true
```

| Config           | Default | Description                                        |
| ---------------- | ------: | -------------------------------------------------- |
| `maxTextBytes`   |   2 MiB | Max size of a single text file to preview          |
| `maxImageBytes`  |  10 MiB | Max size of a single image file to preview         |
| `maxBinaryBytes` |  64 KiB | Max bytes of a binary file to read for its hexdump |
| `maxRawBytes`    | 100 MiB | Per-read cap for raw reads / readRawFile           |
| `showHidden`     |    true | Whether to list dot-prefixed (hidden) files        |
| `inlineCsp`      |    none | Optional Content-Security-Policy for inline html/xhtml/svg via the static route |

## Data layer

The host half registers a `/file-explorer/api` exact route via `ctx.webServer.register()`. Actions (`action` query param):

- `list`: lists one directory level (directories first, by name), returning `BrowserEntry[]`.
- `preview`: reads one file, returning a discriminated `FilePreview` (`text` / `text-large` / `image` / `empty` / `binary` / `too-large`).
- `pdf`: streams a `.pdf` file inline (`Content-Type: application/pdf`) so the browser's native viewer renders it in a new tab.
- `resolve-path`: resolves a workspace-relative path to an absolute path and parent path.
- `write`: writes UTF-8 text to a workspace file (POST body `{ path, content }`), returning the saved relative path.

All paths pass a workspace-containment check (`inside(root, input)`, including `realpath` symlink resolution); out-of-workspace paths are rejected. Text/binary is detected by a NUL-byte scan; images map extensions to MIME and return a data URL. Binary previews return the first `maxBinaryBytes` as base64 (plus a `truncated` flag) for a `hexdump -C`-style hex dump.

The host also registers a `kind: 'prefix'` route at `/file-explorer/files/<sessionId>/<relative path…>` that streams workspace files with a browser-native content type (`text/html`, `text/css`, `image/*`, `application/pdf`, web fonts, audio/video, and `application/octet-stream` for unknowns). It honors `Range`, serves a directory's `index.html`, and always sets `x-content-type-options: nosniff` + `cache-control: no-store`. This is the URL `.pdf`/`.html`/`.htm`/`.xhtml` open in a new tab.

## Model Experience

This plugin is a pure UI surface — it emits no session events and does not modify session logs, so it is invisible to the model. The host half only reads file content for browser preview, independent of agent tool execution.

## Known Limitations and Deferred Work

- **Markdown-only editing**: built-in Markdown previews support inline edit/save (with autosave on file switch and panel close); full CodeMirror text editing across all files is a later phase.
- **Single-file preview**: no multi-tab or inline diff.
- **Automatic refresh is a debounced poll**: while the drawer is open and the tab is visible, the tree re-fetches its loaded directories every ~3s and on focus; there is no server-push (fs.watch) transport.
- **File-link interception is best-effort**: it relies on DSH's CSS class names (`_fileLink`, `data-produced-files-row`); update the selectors if the upstream UI changes.
- **Large files**: large text files stream in pages (past `maxTextBytes` the preview pages via `readRawFile`); image reads are bounded by `maxImageBytes`, and binary hexdumps read only the first `maxBinaryBytes`.
- **Hidden files are shown by default**: dot-prefixed files/directories are listed (the bundle sets `showHidden: true`); set `showHidden: false` in the bundle config to hide them.
- **Client-side search**: the tree search box matches only already-loaded (expanded) entries — files inside collapsed directories are not found; there is no server-side recursive search.

## Developing extensions

`dsh-file-explorer` exposes the `fileExplorer` cordis service: `registerPreview`, `registerFileAction`, `writeFile`, and `readRawFile`. Domain experts can ship extensions as separate plugins (named `@dsh-external/dsh-file-explorer-preview-<domain>`) without touching the core.

See **[Developing a dsh-file-explorer extension](docs/developing-extensions.md)** ([中文](docs/developing-extensions.zh.md)) for the full guide — contracts, routing, handling large/binary files with `readRawFile`, editing with `writeFile`, bundling, i18n, and reference implementations.

Quick skeleton:

```typescript
import type { PreviewProps } from '@dsh-external/dsh-file-explorer/client'

export const inject = ['fileExplorer']

export function apply(ctx: {
  fileExplorer: { registerPreview(ext: string, comp: React.ComponentType<PreviewProps>, priority?: number): () => void }
  effect(cb: () => (() => void), label?: string): void
}): void {
  ctx.effect(() => ctx.fileExplorer.registerPreview('cif', CifPreview, 10))
}
```

## Extensions

`dsh-file-explorer` is designed for extension through the `fileExplorer` service. Known extensions:

| Extension | Description | Repository |
| --------- | ----------- | ---------- |
| `dsh-file-explorer-preview-code` | CodeMirror 6 code preview with editing | [wolfsonliu/dsh-file-explorer-preview-code](https://github.com/wolfsonliu/dsh-file-explorer-preview-code) |
| `dsh-file-explorer-preview-molstar` | Mol* molecular-structure preview (`.cif` / `.pdb`) | [wolfsonliu/dsh-file-explorer-preview-molstar](https://github.com/wolfsonliu/dsh-file-explorer-preview-molstar) |
| `dsh-file-explorer-preview-sequence` | SeqViz sequence viewer preview (FASTA / GenBank / JBEI / SnapGene / SBOL) | [wolfsonliu/dsh-file-explorer-preview-sequence](https://github.com/wolfsonliu/dsh-file-explorer-preview-sequence) |

More extensions are welcome — build your own by following [Developing a dsh-file-explorer extension](docs/developing-extensions.md).

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
