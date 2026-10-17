# FolderDock — Implementation Report

Date: 2026-10-17 · Version 1.0.0 · Windows 11, x64

## Stack

Electron 44 + React 19 + TypeScript 6 (strict) + Vite 8 via electron-vite 6, Tailwind CSS 4 (utilities + preflight) with the prototype's hand-ported CSS for visual fidelity, zustand 5 for state, chokidar 5 for filesystem watching, marked + DOMPurify for sanitized Markdown, pdfjs-dist 6 for PDF rendering, Playwright 1.64 for Electron E2E, Vitest 5 for unit tests, electron-builder 26 for packaging (NSIS + portable).

## Architecture

- `src/main` — owns everything filesystem: root resolution (`Documents\FolderDock` default, `FOLDERDOCK_ROOT` env or Settings override), scanning (one directory level = one collection; loose root files surface as a virtual **Unsorted** collection), file ops (create/rename/move/delete/import/write), atomic text writes (`*.fdtmp` temp + rename), mtime conflict detection, chokidar watcher (debounced → `library:changed`), native drag (`webContents.startDrag` with per-type PNG icons generated at build time by `scripts/gen-icons.mjs`), JSON prefs store in `%APPDATA%`, `fdfile://` protocol restricted to the library root.
- `src/preload` — minimal allowlisted typed bridge (`contextBridge`), `sandbox: true`; `webUtils.getPathForFile` for Explorer drop paths.
- `src/renderer` — React port of the prototype: custom frameless titlebar wired to real window controls, toolbar/search/filters, glass folder cards with individually draggable sheets (0/1/2/3 sheet variants preserved), inside file list, fixed-position context menus, modal system (new folder with art swatches, renames, confirm, move, help, settings), editor with Edit/Preview tabs, side preview (Markdown/text/image/PDF), 250 ms hover summaries with excerpt/meta caches.
- `src/shared` — types, kind detection, excerpt extraction, prefs validation — pure, unit-tested code shared by both processes.

## Drag model (design decision)

Every sheet/row drag triggers a **native** OS drag of the real file (`dragstart` → `preventDefault` → IPC → `sender.startDrag({ file, files, icon })`). Semantics are resolved at drop time by path:

- Dropped into an external target → the original stays (copy semantics).
- Dropped back onto a different collection card → real filesystem **move** (via the same `files:drop` channel used by Explorer drops, which detects library-internal paths).
- Dropped onto its own collection or the shelf background → no-op with an explanatory toast.

This unifies Explorer drop-in and internal moves through one code path and satisfies "dragging out must not delete or move the original".

## Verification

- 35 Vitest unit tests (name/path validation incl. Windows reserved names and traversal, collision naming, excerpt extraction, prefs merge/prune, image header parsing for PNG/JPEG/GIF/BMP/WEBP/SVG, binary sniffing).
- 12 Playwright Electron E2E journeys (boot+seed, real content display, create collection, note→edit→save to disk, rename, move, delete-to-Recycle-Bin, search, hover summary + side preview, Unsorted detection, external change watching, theme persistence).
- Packaged-binary smoke test: `dist\win-unpacked\FolderDock.exe` launched via Playwright with a temp library; scan, open, preview verified.
- Screenshots captured in dark/light, hover/open/preview/editor states (in `desktop-capture/`, git-ignored) compared against the reference HTML.
- **Manual (pending, yours):** native drag-out to Explorer/ editors per `docs/native-drag-test-checklist.md` — OS drag loops cannot be automated.

## Deviations from the handoff / prototype

1. **Simulated external drop zone removed**, as instructed once native drag-out was implemented.
2. **Drag imagery** is a colored type icon (from `resources/drag/*.png`) rather than a live thumbnail; `startDrag` only accepts image assets and generating faithful per-file thumbnails would require an image-processing dependency. Documented as a limitation.
3. **Import semantics**: Explorer drag-in and dialog import **copy** (originals untouched); moving out of *Unsorted* or between collections uses real moves. The prototype's "files added to the selected collection" toast pattern is kept.
4. **Full-screen drop overlay replaced** with a slim bottom hint bar plus per-card glow — the overlay obscured the drop targets themselves.
5. **Side preview** docks to the right edge below the titlebar; on narrow windows (<1020 px) it overlays the shelf, and the window auto-widens once (up to 1040 px) when opened if the work area allows. The prototype floated the panel outside the mock window, which isn't possible inside a real window.
6. **Root-level loose files** are exposed via a virtual *Unsorted* collection (the prototype had no equivalent); the name is reserved against real folder creation.
7. **Deletes go to the Recycle Bin** (`shell.trashItem`) rather than hard-deleting — safer than the prototype's hard removal.
8. **Nested subdirectories** inside a collection are not displayed (flat collection model, matching the prototype's card list). Files in them are untouched and invisible in the UI.
9. The prototype's fake window buttons (minimize/maximize/close/reset-to-demo) became real window controls; "reset" was a demo-only concept.

## Limits & known constraints

- Editor: text/Markdown up to 2 MB, UTF-8 (BOM preserved; other encodings are not transcoded). NUL-bearing content is treated as binary — preview/edit disabled, reveal/open offered instead.
- Preview caps: PDF 30 MB and first 40 pages; import 200 MB per file.
- External concurrent modification is detected via mtime at save time (overwrite / reload-from-disk choice); watcher-based re-validation between keystrokes is not attempted.
- Drag-out drop targets that only accept non-file content will refuse the drop; FolderDock cannot make arbitrary apps accept files.
- Binaries are unsigned — SmartScreen shows a warning on first run.
- The NSIS install is per-user; no auto-updater (local-first, offline product).
- npm audit reports 8 moderate advisories, all transitive in electron-builder's tooling chain (NSIS signing tools); none affect the shipped runtime.

## Deliverables map

| Handoff item | Location |
|---|---|
| Electron source project | `src/` (+ `electron.vite.config.ts`, `electron-builder.yml`) |
| Install/run/build instructions | README.md |
| Reusable typed UI components | `src/renderer/src/components/*` |
| Automated tests | `src/**/*.test.ts` (35), `e2e/app.spec.ts` (12) |
| Manual drag checklist | `docs/native-drag-test-checklist.md` |
| Windows distributables | `dist/FolderDock-Setup-1.0.0.exe`, `dist/FolderDock-1.0.0-portable.exe` (also copied to the Desktop) |
| Reference material | `docs/reference/` (original HTML concept + handoff) |
