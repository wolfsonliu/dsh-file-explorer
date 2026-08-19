# AGENTS.md

`dsh-file-explorer` is a DSH Web plugin: a floating file-explorer panel (a left drawer with a workspace tree, plus a draggable/resizable preview box) with an extensible preview and row-action system. It runs on vendored Cordis, where **everything is a plugin** — the host half and the client half each expose an `apply(ctx)` entry.

- [README.md](README.md) — the user-facing contract (features, install, config, data layer). [README.zh.md](README.zh.md) is the paired Chinese version.
- [docs/developing-extensions.md](docs/developing-extensions.md) — the extension-authoring contract (plus its [.zh.md](docs/developing-extensions.zh.md) twin). This is the source of truth for the `fileExplorer` service API.

## Repository layout

```
src/
  index.ts            host half: Node HTTP route /file-explorer/api (list/preview/resolve-path/pdf/raw/write)
  invariant.ts        no-op runtime-invariant companion plugin ("./invariant" export)
  protocol.ts         wire types + FILE_EXPLORER_ROUTE/PDF_ACTION — the single contract between halves
  client/
    index.ts              browser half: reflects the fileExplorer service, registers built-ins,
                          injects PANEL_CSS + a React root, wires file-link interception & Ctrl/Cmd+Shift+E
    contract.ts           public extension contract: FileExplorerService + re-exports (PreviewProps, FileAction, Translate)
    app.tsx               FileExplorerApp — composes the three surfaces + the open-file / edit-save state machine
    drawer.tsx            FloatingFileButton + FileExplorerDrawer (left drawer, width resize + localStorage persistence)
    panel.tsx             FileExplorerPanel — draggable/resizable/maximizable preview box
    file-tree.tsx         lazy directory tree (recursive disclosure; per-row action menu)
    context-menu.tsx      generic anchored popup menu (the row "···" menu)
    file-action.ts        row-action registry + built-ins (open / open-as-text / open-as-binary / copy path ×2)
    intercept.ts          capture-phase interception of tool-row file links & produced-file chips
    icons.tsx             inline DSH SVG icon components (fill="currentColor")
    locale.ts             ZH/EN dictionaries + locale registration (key sets must stay identical)
    styles.ts             PANEL_CSS string, injected as a <style data-fe-style> tag
    preview/
      registry.ts         registerPreview / resolvePreview / previewKeyOf — priority; 'binary' fallback key
      index.ts            built-in registration + resolvePreviewFor (kind-aware routing)
      text.tsx            TextPreview
      markdown.tsx        MarkdownPreview (marked + DOMPurify sanitize)
      image.tsx           ImagePreview
      binary.tsx          BinaryPreview (hexdump)
      status.tsx          StatusPreview + formatBytes
      hexdump.ts          hand-rolled `hexdump -C`-style formatter (no dependency)
tests/                vitest specs — node env by default; *.spec.tsx opt into jsdom
lib/                  built output, tracked — bundled index.js/invariant.js/client.js + client.js.map + lib/types (JS + .d.ts for every src file)
docs/                 developing-extensions.{md,zh.md} are tracked; specs/ & plans/ are gitignored local-only
assets/               screenshots + title image
cordis.patch.yml      bundle patch layer — inserts the plugin and sets default config caps
README.i18n.yaml      bilingual-pair record (git blob hashes of README.md / README.zh.md)
```

## Commands

```sh
npm install
npm test          # vitest run (tests/**/*.spec.{ts,tsx})
npm run check     # tsc --noEmit (type-checks src/ only; tests are NOT type-checked)
npm run build     # tsc + tsdown → host ESM lib/index.js + client CJS bundle lib/client.js (+ lib/types)
```

- Run one spec with `./node_modules/.bin/vitest run tests/<file>` — never `npx vitest` (the npm cache is read-only in this environment).
- `npm run check` covers `src/` only: `tsconfig.json` includes `src/**/*.{ts,tsx}` and excludes `tests`. Tests are exercised at runtime by vitest, not by `tsc`.
- `tsdown.config.mjs` owns the two-bundle split. The host build emits ESM (`lib/index.js`, `lib/invariant.js`); the client build emits a single CJS `lib/client.js` wrapped as a `window.__ModuleLoader__.load({ id, factory: require => … })` factory. The client's `neverBundle`/`alwaysBundle` (`platformModules`) list and `package.json`'s `dsh.client.inject` (`@deepseek-ai/dsh-client-runtime`, `@deepseek-ai/dsh-client-locale`) describe what the host supplies at runtime — keep them in sync with any new client-side import or declared inject dependency.

## Build & commit rules

- `lib/` is committed (including every `lib/types/**` file). After any `src/` change, run `npm run build` and commit the regenerated `lib/` as its own `chore: rebuild lib artifacts` commit. Downstream consumers resolve `lib/` directly, so it must never lag `src/`.
- `docs/specs/` and `docs/plans/` are gitignored — never commit them. (`docs/developing-extensions.{md,zh.md}` is NOT gitignored and IS tracked.)
- Commit messages use conventional prefixes: `feat:`, `fix:`, `test:`, `chore:`, `docs:`.
- Do not fold unrelated working-tree changes into a feature commit; keep them separate (unless the user asks otherwise).

## Architecture conventions

- **Two halves, one protocol.** The host (`src/index.ts`, `inject: ['webServer', 'sessions']`) is the only side with filesystem access; it registers `/file-explorer/api`. The client (`src/client/index.ts`, `inject: ['sessions', 'workspaces', 'locale']`) renders the UI and calls that route over `fetch`. Every wire type lives in `src/protocol.ts` (`BrowserEntry`, `FilePreview`, `ApiResponse`, `Config`, `PreviewMode`) — change both sides together.

- **Host route actions.** The handler reads `sessionId`, `path`, `action`, `mode`, and (POST) `content` from a JSON body or the query string; POST bodies are bounded at 3 MiB (`requestBody`). The session's workspace root is resolved from `sessions.get(sessionId).header.cwd`. Actions:

  | action | method | returns |
  | --- | --- | --- |
  | `list` | GET/POST | `{ ok, root, entries: BrowserEntry[] }` — one directory level, dirs first then files, each alphabetically by name; symlinks skipped |
  | `preview` | GET/POST | `{ ok, preview: FilePreview }` — `mode` ∈ `auto`/`text`/`binary` |
  | `resolve-path` | GET/POST | `{ ok, path, parentPath }` — absolute paths |
  | `pdf` | GET | streams the file inline (`Content-Type: application/pdf`), whitelisted extension `.pdf` only |
  | `raw` | GET | `application/octet-stream`; honors `Range` (200/206/416), capped per-read at `maxRawBytes` |
  | `write` | POST | `{ ok, saved }` after writing UTF-8 text (`body.content` required) |

- **Registrations are effects.** `registerPreview(ext, component, priority?)` and `registerFileAction(action)` return disposers. The client calls built-in registration at `apply` and exposes the same functions through the `fileExplorer` service; external plugins call them inside `ctx.effect()` and return the disposer so unload/HMR cleans up. For previews: higher priority wins; later registration wins ties; built-ins use priority `0`.

- **Kind-aware routing.** `resolvePreviewFor(preview, ext)` routes on the discriminated `preview.kind` first: `image` → ImagePreview; `empty` → BinaryPreview (status); non-text (`binary`/`too-large`) → the extension-registered component or BinaryPreview when unregistered; `text` → the extension-registered component or TextPreview when unregistered (e.g. an extension-less file). Add a `FilePreview` variant by extending the union in `src/protocol.ts`, producing it in `src/index.ts`, and handling its `kind` in `resolvePreviewFor` plus the owning preview component.

- **The `fileExplorer` service is the extension point.** The client reflects `ctx.reflect.provide('fileExplorer', { registerPreview, registerFileAction, writeFile, readRawFile })`; external plugins (`@dsh-external/dsh-file-explorer-preview-*`) inject it. `FileExplorerService` in `src/client/contract.ts` is the stable, public contract — treat its signatures as semver-stable (incl. the re-exports of `PreviewProps`, `FileAction`, `FileActionHelpers`, `Translate`).

- **Reads are bounded and contained.** Every path passes `inside()` (realpath symlink resolution + workspace-containment rejection) before any read/write/stream. Caps are `maxTextBytes` / `maxImageBytes` / `maxBinaryBytes` / `maxRawBytes`, normalized once in `apply` through `capBytes`. Binary reads only the head (`readHead`/`raw` loop over short reads), never the whole file. Never read an unbounded file.

- **Single client root, torn down by the disposer.** The browser half injects one `<style data-fe-style>` and one `<div data-fe-host>` React root. It re-renders on `sessions.list.subscribe` and `locale.subscribe`; the returned `ctx.effect` disposer removes listeners, unmounts the root, and deletes both injected nodes. Keep the disposer complete — this is what makes unload/HMR safe.

- **Styles are injected, not imported.** An external plugin cannot import a CSS module, so styles live in `PANEL_CSS` (`src/client/styles.ts`) and are injected as a `<style>` tag. Local tokens are `var(--fe-*)` defined on `.dsh-fe-panel`; theme surface values are `var(--dsw-alias-*, fallback)`. Prefer class-selector scoping with no globals that could leak outside `.dsh-fe-*`.

## Configuration

`Config` (`src/protocol.ts`) is validated at `apply`, not hardcoded: each cap falls back to its default via `capBytes` when missing or non-positive. Defaults are also seeded in `cordis.patch.yml`.

| Config          | Default   | Description                                                       |
| --------------- | --------: | ----------------------------------------------------------------- |
| `maxTextBytes`  |     2 MiB | Max bytes of a single text file to preview                        |
| `maxImageBytes` |    10 MiB | Max bytes of a single image file to preview                       |
| `maxBinaryBytes`|   64 KiB  | Max bytes of a binary file to hexdump                             |
| `maxRawBytes`   |  100 MiB  | Per-read cap for the `raw` action / `readRawFile` (not total size)|
| `showHidden`    |     false | Whether dot-prefixed (hidden) files are listed                    |

When adding or changing a cap, update `Config`, `cordis.patch.yml`, this table, and the README together.

## Coding conventions

- Strict TypeScript (`strict: true`, `noEmitOnError`), ESM everywhere (`"type": "module"`), `.ts`/`.tsx` extensions in relative imports (`allowImportingTsExtensions` + `rewriteRelativeImportExtensions`).
- Switch on the discriminated `preview.kind` / `entry.kind` tags rather than scattering type-narrowing checks without a documented default.
- Trust TypeScript at typed same-process boundaries: do not add runtime validation for values the `FilePreview`/`BrowserEntry` unions already guarantee. Validate at the wire (`requestBody`/route params) and config (`capBytes`) boundaries instead.
- React uses `jsx: react-jsx` (no `React` import needed just for JSX); import hooks/types by name. Components exposing imperative controls use `forwardRef` + `useImperativeHandle` (see `FileExplorerAppHandle`, `FileTreeHandle`, `FileExplorerPanelHandle`). Async state updates after unmount are guarded by a `mountedRef`/`cancelled` flag.
- **`data-fe-*` attributes are the test-hook contract.** Tests locate nodes via `[data-fe-drawer]`, `[data-fe-action="refresh"]`, `[data-fe-action-button]`, `[data-fe-edit="save"]`, `[data-fe-host]`, etc., never via fragile class-name or text matching. When you add interactive surface, add a stable `data-fe-*` hook and keep existing hook values backward-compatible (tests assert against them).
- An empty `catch` names what it swallows and why nothing else can reach it (e.g. `// Ignore preview fetch failures.`); keep the `try` to one statement.
- Sanitize any rendered untrusted HTML — Markdown output passes through `DOMPurify.sanitize(marked.parse(...))` before `dangerouslySetInnerHTML`. Do not drop this pipeline.
- Prefer zero new dependencies for small pure helpers (e.g. the hand-rolled `hexdump()` / `formatBytes()`) over pulling a package for one function. The only runtime deps are `marked` and `dompurify`; `react`/`react-dom` are peer platform modules supplied by the host.
- Files end with exactly one trailing newline. Keep `lib/` and `src/` in lockstep per the build rules above.

## i18n & bilingual docs

- UI copy lives in `src/client/locale.ts` as `ZH`/`EN` const objects. **Key sets must stay identical** — `tests/locale.spec.ts` enforces parity, so any new string is added to both dictionaries at once. The client registers both under `file-explorer` and binds `t` via `locale.bind`.
- `README.md` / `README.zh.md`, and `docs/developing-extensions.md` / `.zh.md`, are bilingual pairs of equal authority. `README.i18n.yaml` records the git blob hash of each side as of the last confirmed-consistent state; after editing one side, bring the other along and re-record (the `verify-translation-pairing` command belongs to the DSH monorepo tooling referenced in that file's header, not to this package's own scripts).
- The client signature uses the core `Translate` (`(key, params?) => string`) rather than raw strings, so action/preview labels follow locale switches (see `FileAction.label`).

## Testing

- Tests live in `tests/` and describe behavior, not implementation. `*.spec.ts` run under node; `*.spec.tsx` begin with `// @vitest-environment jsdom`.
- Follow TDD: write the failing test, watch it fail, then implement the minimum to pass.
- Coverage map:

  | Spec | Covers |
  | --- | --- |
  | `host-route.spec.ts` | host internals end-to-end against a temp workspace + a real `createServer`; `inside`/`capBytes`/`list`/`preview`/`write`/`raw` and every route action incl. Range 206/416 |
  | `registry.spec.ts` | preview registry priority, ties, disposer idempotency, `binary` fallback |
  | `preview-components.spec.tsx` | preview component rendering + `resolvePreviewFor` routing |
  | `app.spec.tsx` | `FileExplorerApp` state machine — open/close, preview routing fallback, markdown edit/save/autosave (injectable `fetchList`/`fetchPreview`/`writeFile`) |
  | `apply.spec.tsx` | client `apply` bootstrap — style/host injection, render, and full teardown on disposer |
  | `file-action.spec.ts` | action registration + `appliesTo` filtering |
  | `drawer.spec.tsx` / `panel.spec.tsx` | surface geometry, resize/drag/maximize, persistence |
  | `file-tree.spec.tsx` / `context-menu.spec.tsx` | tree disclosure + menu open/outside-close |
  | `intercept.spec.tsx` | file-link / produced-file chip interception |
  | `icons.spec.tsx` | icon components render |
  | `hexdump.spec.ts` | hexdump formatting (pure) |
  | `locale.spec.ts` | ZH/EN key parity |

## Developing extensions

Extensions ship as separate plugins and inject the `fileExplorer` service. The authoritative guide is [docs/developing-extensions.md](docs/developing-extensions.md) (keep it and its `.zh.md` twin updated whenever the service contract changes). The minimal shape:

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

Changing `FileExplorerService` is a breaking change for those downstream plugins — bump carefully and update the extension docs in the same commit.