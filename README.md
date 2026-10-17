# FolderDock

A local-first Windows file shelf: animated glass folders that hold **real files on disk**. No login, no cloud, no server — everything stays in a folder you control.

FolderDock is a desktop application built with Electron, React, TypeScript and Vite. It reimplements the interactive HTML concept in `docs/reference/FolderDock_Interactive_v2.html` with genuine Windows integration.

## What it does

- **Glass folder collections** — two animated folders per row. Click the frosted front to open a collection in place; its files appear in an internal, scrollable list.
- **Paper sheets that are real files** — each folder shows up to three named sheets representing its newest files. Their labels, type tags and summaries come from the actual files.
- **Native drag-out** — grab a visible sheet (or a file row) and drag it into Explorer, an editor, an email, or any app that accepts files. The original always stays in your library.
- **Drag-in from Explorer** — drop files onto a collection card to copy them in, or onto the shelf background to copy them into the open collection. Files already inside the library are *moved*, never copied over themselves.
- **250 ms hover summaries** — hover any sheet or row for a floating excerpt (derived from real content for Markdown/text; dimensions and size for images/PDFs).
- **Side preview** — click a sheet or row for a full sidecar panel: rendered Markdown (sanitized), plain text, actual images/SVGs, and PDF pages via a sandboxed pdf.js renderer.
- **Markdown/text editor** — double-click or press *Edit*. Atomic writes (temp file + rename), BOM preservation, and conflict detection when a file changed on disk after you opened it.
- **Real operations** — create, rename, delete (to Recycle Bin), reorder collections; move files between collections; import via dialog or drag. Filesystem watching keeps the UI in sync with external changes.
- **Search, filters, stars, themes** — Ctrl+F search, category filters, starred files, light/dark themes, keyboard shortcuts (Ctrl+N new note, Ctrl+S save, F2 rename, Del delete, Esc close topmost).
- **Unsorted** — loose files at the library root appear in a built-in *Unsorted* collection so nothing is ever hidden.

## Where your files live

The library root is a normal Windows folder, `Documents\FolderDock` by default (created with a welcome note on first run). Change it anytime in **Settings**. UI preferences only (theme, folder order/colors, stars, window geometry, last open collection) are stored in `%APPDATA%\FolderDock\ui-prefs.json` — never file contents.

## Development

Requires Node 20.19+ (tested on Node 22). Everything installs project-locally; no global tooling is touched.

```bash
npm install        # dependencies (Electron binary downloads into node_modules)
npm run dev        # launch with hot reload
npm run icons      # regenerate build/icon.ico + resources/drag/*.png (run automatically by dev/build)
npm run typecheck  # tsc for main+preload and renderer
npm run lint       # eslint
npm run test       # vitest unit tests (path validation, file ops, excerpt, image metadata)
npm run test:e2e   # builds, then Playwright Electron end-to-end journeys (12 tests)
npm run dist       # build + electron-builder: NSIS installer + portable exe into dist/
```

Useful environment overrides: `FOLDERDOCK_ROOT` (force a library root, e.g. for testing), `FOLDERDOCK_USER_DATA` (redirect prefs), `FOLDERDOCK_DEVTOOLS=1` (open devtools), `FOLDERDOCK_SOFTWARE_GPU=1` (disable GPU, used by tests).

## Installation

Run `FolderDock-Setup-1.0.0.exe` (per-user install, choose your own directory, Start menu + desktop shortcuts). A portable single-file `FolderDock-1.0.0-portable.exe` is also produced. The binaries are unsigned — Windows SmartScreen may show a warning; choose *More info → Run anyway*.

## Security model

- Renderer runs with `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` and a strict CSP. The preload script exposes a minimal, typed, allowlisted IPC bridge only.
- All filesystem operations happen in the main process and validate that every path resolves **inside the library root**.
- Markdown is rendered through marked + DOMPurify with a strict allow-list; SVGs are displayed as images (scripts never execute); PDFs are rendered in pdf.js without plugins; imported files are never executed.
- `fdfile://` media protocol serves only paths that resolve inside the library root.
- External http(s) links from Markdown open in the default browser; in-app navigation is blocked.

## Browser demo vs. native app

The original HTML concept (`docs/reference/`) ran entirely in a browser: files lived in IndexedDB and “drag out to another app” was simulated with a fake drop zone. This app replaces all of that with a real filesystem and `webContents.startDrag`; the simulated external drop zone has been removed. See `docs/implementation-report.md` for decisions, limitations, and `docs/native-drag-test-checklist.md` for the manual Windows drag verification steps.
