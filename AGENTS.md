# AGENTS.md

`dsh-file-explorer` is a DSH Web plugin: a floating file-explorer panel (left drawer + draggable preview box) with an extensible preview system. It runs on vendored Cordis, where **everything is a plugin** — the host half and the client half each expose an `apply(ctx)` entry. Read [README.md](README.md) for the user-facing contract; [ref/dsh-source/AGENTS.md](ref/dsh-source/AGENTS.md) documents the harness conventions this project inherits.

## Repository layout

```
src/
  index.ts           host half: Node HTTP route /file-explorer/api (list/preview/resolve-path/write)
  invariant.ts       no-op runtime-invariant plugin (./invariant export)
  protocol.ts        wire types shared by host and browser halves
  client/
    index.ts         browser half: registers built-ins, reflects the fileExplorer service, mounts React
    contract.ts      public client contract: FileExplorerService + PreviewProps/FileAction/Translate re-exports
    app.tsx          FileExplorerApp (drawer + tree + preview box state machine)
    preview/         registry + built-ins (text, markdown, image, binary/hexdump, status)
    file-action.ts   row-action registry (open / open-as-text / open-as-binary / copy path)
    locale.ts        ZH/EN dictionaries (key sets must stay identical)
    styles.ts        PANEL_CSS injected as a <style> tag
tests/               vitest specs (node env; *.spec.tsx opt into jsdom)
lib/                 built output — tracked; rebuild and commit after src changes
docs/                specs/ and plans/ — gitignored, local-only
ref/                 exploration clones (dsh-source reference) — gitignored
assets/              screenshots and title image
cordis.patch.yml     bundle patch layer
```

## Commands

```sh
npm install
npm test          # vitest run (tests/**/*.spec.{ts,tsx})
npm run check     # tsc --noEmit (type-checks src/ only; tests are NOT type-checked)
npm run build     # tsc + tsdown: host ESM lib/index.js + client CJS bundle lib/client.js
```

- Run one spec with `./node_modules/.bin/vitest run tests/<file>` — never `npx vitest` (the npm cache is read-only in this environment).
- `npm run check` covers `src/` only (`tsconfig.json` includes `src`, excludes `tests`); tests are exercised by vitest at runtime.
- `tsdown.config.mjs` owns the two-bundle split (host ESM vs client CJS). The client bundle is a `window.__ModuleLoader__.load` factory; keep `package.json`'s `dsh.client.inject` platform list in sync with client imports.

## Build & commit rules

- `lib/` is committed. After any `src/` change, run `npm run build` and commit the regenerated `lib/` as its own `chore: rebuild lib artifacts` commit.
- `docs/` (specs and plans) and `ref/` are gitignored — never commit them.
- Commit messages use conventional prefixes: `feat:`, `fix:`, `test:`, `chore:`, `docs:`.
- Do not fold unrelated working-tree changes into a feature commit; keep them separate (unless the user asks otherwise).

## Architecture conventions

- **Two halves, one protocol.** The host (`src/index.ts`, `inject: ['webServer', 'sessions']`) owns filesystem access and exposes `/file-explorer/api`; the client (`src/client/index.ts`, `inject: ['sessions', 'workspaces', 'locale']`) renders the UI. All wire types live in `src/protocol.ts` and are the single contract between halves — change both sides together.
- **Registrations are effects.** `registerPreview(ext, component, priority?)` and `registerFileAction(action)` return disposers; call them inside `ctx.effect()` and return the disposer so unload/HMR cleans up. Higher priority wins; later registration wins ties; built-ins use priority `0`.
- **Kind-aware routing.** `resolvePreviewFor(preview, ext)` routes on the discriminated `preview.kind` first: `image` → ImagePreview; non-text (`binary`/`empty`/`too-large`) → BinaryPreview; `text` → the extension-registered component, or TextPreview when the extension is unregistered. Add a `FilePreview` variant by extending the union in `src/protocol.ts` and handling it in `resolvePreviewFor` and the owning preview component.
- **The `fileExplorer` service is the extension point.** The client reflects `ctx.reflect.provide('fileExplorer', { registerPreview, registerFileAction, writeFile })`; external plugins (`@dsh-external/dsh-file-explorer-preview-*`) inject it. Keep `FileExplorerService` (`src/client/contract.ts`) stable.
- **Reads are bounded and contained.** Every path passes `inside()` (realpath symlink resolution + workspace containment) before any read; caps are `maxTextBytes` / `maxImageBytes` / `maxBinaryBytes`, normalized through `capBytes`. Never read an unbounded file.
- **Styles are injected, not imported.** The client is one bundle; styles live in `PANEL_CSS` (`src/client/styles.ts`) and are injected as a `<style>` tag. Local tokens are `var(--fe-*)` defined on `.dsh-fe-panel`; theme values are `var(--dsw-alias-*, fallback)`.

## Coding conventions

- Strict TypeScript (`strict: true`), ESM everywhere (`"type": "module"`), `.ts`/`.tsx` extensions in relative imports.
- Switch on the discriminated `preview.kind` / `entry.kind` tags rather than scattering type-narrowing checks without a documented default.
- Trust TypeScript at typed same-process boundaries: do not add runtime validation for values the `FilePreview`/`BrowserEntry` unions already guarantee. Validate at the wire (`requestBody`) and config (`capBytes`) boundaries instead.
- Config is validated, not hardcoded: deployment-varying caps are `Config` fields normalized in `apply`.
- An empty `catch` names what it swallows and why nothing else can reach it (e.g. `// Ignore preview fetch failures.`); keep the `try` to one statement.
- Prefer zero new dependencies for small pure helpers (e.g. the hand-rolled `hexdump()` formatter) over pulling a package for one function.
- Files end with exactly one trailing newline.

## Testing

- Tests live in `tests/` and describe behavior, not implementation. `*.spec.ts` run under node; `*.spec.tsx` begin with `// @vitest-environment jsdom`.
- Follow TDD: write the failing test, watch it fail, then implement the minimum to pass.
- The host API is tested end-to-end against a temp workspace (`host-route.spec.ts`); previews and registry routing are tested by rendering components (`preview-components.spec.tsx`); the locale dictionary is tested for ZH/EN key parity (`locale.spec.ts`).
