# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-08-22

### Added

- File-tree sorting: a sort selector at the top of the drawer reorders the
  tree by name, size, or modified time, in ascending or descending order.
  Directories always group before files, and name is the ascending tiebreak.
  Already-loaded rows reorder immediately, and the choice also applies to rows
  fetched afterwards.
- A modified-time (`mtimeMs`) field on each listed entry, populated by the
  host and used by the modified-time sort order (optional and additive — the
  public service contract is unchanged).
- Built-in CSV preview: `.csv` files render as a read-only table whose first
  row is the header. Rendering is bounded to 1000 rows × 256 columns with a
  truncation note; files over the text cap fall back to the paged text
  renderer, and the parser is hand-rolled (no new dependency).
- `.json` files now open in the browser's native viewer by default, alongside
  the existing open-as-text action.

## [0.5.0] - 2026-08-22

### Added

- Client-side file-tree search: a search box at the top of the drawer filters
  already-loaded entries by name or path (case-insensitive). Search is
  client-side only — files inside collapsed directories are not matched (no
  server-side recursive search).
- File operations on the workspace tree: a "＋ New" button in the drawer title
  bar opens a new-file / new-folder menu; the row "···" menu gains rename,
  move, copy, and delete (delete is rendered in a danger color; directory rows
  also gain new-file / new-folder).
- A single modal handles every file operation: a text input for new/rename, a
  confirmation for delete, and a recursive destination picker for move/copy
  that lists directories and excludes the target directory and its
  descendants. Renaming or moving the open file re-paths the preview; deleting
  it clears the preview.
- Six workspace-contained host mutation actions (`create-file`, `mkdir`,
  `rename`, `move`, `copy`, `delete`), POST-only and guarded by `inside()`
  (realpath containment). They reject `..`, invalid names, self-or-descendant
  move/copy targets, and non-directory destinations, and invalidate the
  directory-list cache on success.
- New i18n keys for the file-operation UI (ZH and EN, key sets identical).
- Extension authors: `FileAction` gains an optional `danger` flag, and
  `FileActionHelpers` gains `promptRename` / `promptDelete` / `promptMove` /
  `promptCopy` / `promptNewFile` / `promptNewFolder` (additive — the public
  `fileExplorer` service shape is unchanged).

## [0.4.0] - 2026-08-21

### Added

- Static file route `/file-explorer/files/<sessionId>/<path…>` that streams
  workspace files with browser-native MIME types, honors `Range`
  (200/206/416), serves a directory's `index.html`, and always sets
  `x-content-type-options: nosniff` + `cache-control: no-store`.
- `Config.inlineCsp` (optional) — a `Content-Security-Policy` applied to
  inline `html`/`xhtml`/`svg` responses from the static route.
- Default open now routes `.html`, `.htm`, and `.xhtml` (alongside `.pdf`)
  through the browser's native renderer in a new tab.

### Changed

- Hidden files are now shown by default (`showHidden: true` in the bundle
  config; set `showHidden: false` to restore the previous behavior).

### Fixed

- Dragging the preview box could push its title bar past the viewport edge,
  leaving it un-closeable, un-maximizable, and un-draggable. The position is
  now clamped so the title bar always stays in view, and re-clamped on window
  resize and when restoring from maximize.

## [0.3.1] - 2026-08-20

### Fixed

- The floating file button no longer shifts its icon on hover: the expanded
  state now keeps the collapsed `padding`, so the icon stays pinned and only the
  label fades in beside it.

## [0.3.0] - 2026-08-19

### Upgrading from 0.2.x (extension authors)

The stable service contract (`registerPreview`, `registerFileAction`,
`writeFile`, `readRawFile`) is unchanged. Review the following four points; most
extensions keep working without edits.

1. **`FilePreview` gained a `text-large` variant.** The discriminated union now
   includes:

   ```ts
   | { kind: 'text-large'; name: string; extension: string; size: number }
   ```

   A file whose text `size` exceeds `maxTextBytes` is now returned as
   `text-large` instead of `too-large` (images over their cap still return
   `too-large`). If your preview component switches on `preview.kind`, add a
   `text-large` case or let it fall through to your existing "unhandled /
   too-large" path. An exhaustive `switch` that doesn't handle `text-large`
   will fail to compile against the new type. When no reader is available, a
   `text-large` file falls back to the built-in "File too large" status page.

2. **`resolvePreviewFor(preview, ext, readRawFile?)` accepts an optional third
   argument.** It is backward compatible (two-argument calls still work). If
   your code calls this internal helper, pass your reader so `text-large` files
   page through `readRawFile`; without it the built-in paged renderer degrades
   to the status page.

3. **`Config.showHidden` (default `false`).** Dot-prefixed files/directories
   are now hidden from directory listings by default. Set `showHidden: true` in
   the bundle config to restore the previous behavior.

4. **Routing note:** built-in text extensions (`.ts`, `.js`, `.json`, …) now
   register the paged text renderer, so a `text`-kind preview for those
   extensions renders through the paged component with identical markup (it
   still renders plain `pre`/`code` for small files). Extensions registering a
   higher-priority component for a text extension still win.

### Added

- HTTP `Range` support on the `pdf` action, returning `206`/`416` with
  `Accept-Ranges: bytes` and shared range parsing (`parseRange`).
- Paged streaming preview for large text files (`text-large`) via the existing
  `readRawFile` (512 KiB chunks, streaming `TextDecoder`).
- Directory-listing cache keyed by `root + path + showHidden`, invalidated on
  write and by directory mtime plus a 2s TTL (`invalidateListCache`).
- `Config.showHidden` (dotfiles hidden by default).
- File-tree auto-refresh: a 3s debounced poll plus focus/visibility refresh that
  re-fetches the root and expanded directories without collapsing them.
- Virtualized file tree (`VirtualList`) so directories with many entries render
  only a visible window.
- i18n keys `loadMore` / `textLoaded` (ZH and EN, key sets identical).

### Changed

- Dot-prefixed files/directories are hidden by default (opt out via
  `showHidden: true`).
- Small built-in text files render through the paged text component (visually
  identical; enables paging past the cap).

### Fixed

- `loadMore` no longer appends a stale file's chunk when switching files
  mid-read (load-token guard).