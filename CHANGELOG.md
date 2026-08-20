# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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