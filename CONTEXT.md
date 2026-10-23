# CONTEXT.md — FolderDock domain and architecture vocabulary

Shared language for agents and humans working on this codebase. Terms in the renderer, main process, docs, and tests mean exactly what is written here.

## Domain terms

- **Library**: the user's whole file universe. A real directory on disk (the **root**), defaulting to `Documents\FolderDock`. Nothing is stored anywhere else; every item in the UI maps to a real file or folder inside it.
- **Root**: the library's directory on disk. Changeable in Settings; overridable for tests with `FOLDERDOCK_ROOT`.
- **Collection**: a real subfolder of the root, drawn as a glass folder card. The user-facing word for a folder inside the library is always "collection."
- **Unsorted**: the virtual collection for files sitting loose in the root. It has no folder on disk; its files are the root's loose files. It cannot be renamed, deleted, or reordered.
- **Art style**: the color treatment of a collection card. Named ids live in `src/shared/art-values.ts` (grouped Classics/Vivid/Deep in `lib/art.ts`); a 6-digit hex value is a custom color, synthesized into a glass gradient by `customArtFor`. Pinned styles live in `folderArt`; unpinned collections follow the name hash or the `newFolderArt` setting. Custom colors picked through the in-app picker are remembered in the `customColors` palette (deletable; deleting a palette entry never unpins a collection, since each collection stores its own hex).
- **Paper sheet**: the document-styled preview card on a collection, and the drag-out affordance for one file.
- **Shelf**: the dashboard grid of collection cards.
- **Collection page**: the full-window view of one collection's contents. Clicking a folder card opens it (creating a collection opens it too); the back button or Esc returns to the shelf. The search box and filter chips apply to the page's file list, and dropping files on the page moves them into that collection. `openFolder` names the collection whose page is open. The INSIDE FOLDER panel under a card only expands during search, as an inline results peek. The `fontSize` setting (Small/Medium/Large, default Medium) scales the page; the cards-shrink `--grid-zoom` never applies to it.
- **Drop zone**: the dashed strip under the toolbar. Dropping files from Explorer there moves them into the library using the same target rule as shelf-background drops (open collection, else first collection, else Unsorted); clicking it opens the import picker.
- **Favorites**: files and collections the user starred via the star button on a file row or collection card. The Favorites filter shows starred collections in full plus starred files. `starred` holds file relPaths and collection names. The file context menu has no favorites item — the row's star button is the only toggle.
- **Bridge**: the typed renderer-to-main interface (`FolderDockBridge` in `src/shared/api.ts`, exposed as `window.folderdock`). All cross-process calls go through it.
- **Channel map**: `src/shared/channels.ts`. The single place that names every IPC channel; preload and the main handlers both read from it.
- **Settings**: persisted user preferences owned by the preferences module (`src/renderer/src/state/prefs.ts`). Fields: theme, alwaysOnTop, viewSize, fontSize, cardColumns, fileSort, closeToTray, confirmDelete, hoverDelay, newFolderArt, backupLocation, customColors. One seam: `boot` / `patch` / `setTheme` / `setViewSize` / `resetSettings`.
- **Preferences module**: `state/prefs.ts`. Deep module that owns settings hydration, validation-aware persistence, and the DOM consequences (`body.light`, `body.compact`, the `--grid-zoom` cards-shrink-to-fit variable) including the system-theme media listener and the window resize listener.
- **Backup**: a manual, timestamped folder copy of the whole library into the backup location (the `backupLocation` setting, default `Z:\REA-Backups`), triggered from Settings or the Backups dialog. A backup run copies only; old backups can be deleted from the Backups dialog, which moves the backup folder to the Recycle Bin like every delete.
- **Library view state**: folderOrder, folderArt, starred, openFolder. Persisted preferences that describe a view of the library rather than app behavior. They deliberately live in the session store (`state/ui.ts`), not the preferences module, and are pruned by the main process on scan.
- **Session state**: everything else in `state/ui.ts` — modals, selection, search, editor, preview, toasts. Never persisted.
- **Excerpt**: the plain-text summary of a file, shown on paper sheets and hover summaries. Cached per file, keyed by mtime (`state/excerpts.ts`).
- **Content match**: a search result from inside file contents (`searchContent`), rendered as a snippet on the file row.
- **Orphan preference**: a persisted entry naming a collection that no longer exists. The main process prunes these during `library:scan` via `prunePrefs`.
- **Dialog router**: `components/ModalLayer.tsx` maps a `Modal` union member to one module in `components/modals/`. Each dialog is its own module; `modals/kit.tsx` holds Head, Foot, and Toggle. The file preview is a separate blocking overlay (`PreviewModal`) driven by `previewRelPath` session state, not a modal-union member; it never resizes the window.

## Invariants

- Files are real on disk under the root, never in app/browser storage.
- Deleting moves to the Windows Recycle Bin.
- Importing files from outside the library (drops, the drop zone, the import picker) moves them: same-volume rename when possible, otherwise copy into the library and recycle the source.
- The UI stays faithful to the glass-folder card design (`docs/reference/FolderDock_Interactive_v2.html`), with the 182px rescaled values in `src/renderer/src/styles/folder.css`.
- Installers are unsigned; SmartScreen warnings are expected.
- All IPC channel names come from the channel map; never write a channel string literal elsewhere.
