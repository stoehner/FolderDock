# Native Drag & Drop — Manual Windows Test Checklist

Automated tests cover the UI and filesystem logic, but true OS drag interactions need human hands. Run through this list after installing (or with `npm run dev`).

> **Behavior since 2026-11-01 (disk-truth fix; supersedes the 2026-10-31 wording):** every file drag — single or multi — rides the native OS carrier (no HTML5 drag session, no `dragend` outcome gate; that gate proved a Chromium guess on Windows and was the bug that recycled originals on refused drops). The settle scan chain reads the disk instead: first scan 1.2 s after the drag starts, up to 3 scans over ~10 s. File gone from the library and its name in no other collection = Windows moved it away -> the sheet/row leaves the collection and a toast reports `"name" moved out of the library`. File still there (refused drop, Esc, Alt-drag, Ctrl-copy, different-drive drop, an editor taking a copy) = keep: nothing recycles, no toast. Dragging back onto a FolderDock surface now works like any Explorer drop (import path: real move on disk, dedupe and collision rules apply).

## A. Drag out (FolderDock → external)

1. **Sheet → Explorer (same drive)**
   - [ ] Open FolderDock, hover a folder, grab a visible paper sheet, drag it onto the Desktop / an Explorer window on the same drive.
   - [ ] Expected: the real file appears at the drop location with correct name, extension and **readable content** (open the dropped `.md`/`.txt` in Notepad).
   - [ ] Within a few seconds a toast reports `"name" moved out of the library` and the sheet leaves the collection. The file at the target is the original itself — Windows moved it, so nothing sits in the Recycle Bin.
   - [ ] Variation (the keep-branch): drop it onto a folder on a **different drive**, or hold **Ctrl**. Expected: the target receives a copy while the library entry **stays** — no recycle, no toast.
2. **Sheet → text editor** (VS Code or Notepad++)
   - [ ] Drag a `.md` sheet into the editor window. Expected: the editor opens and shows the real file content (no plain-text blob, no shortcut).
   - [ ] Expected: the library entry **stays** — editors keep the file in place (a reference or copy, not a move), and with the disk-truth verdict an editor drag can no longer send the original to the Recycle Bin. A file lock held by the editor changes nothing for FolderDock either.
3. **Sheet → browser**
   - [ ] Drag an image sheet into a Chrome/Edge window. Expected: the browser displays/accepts the image (many, not all, apps accept type-specific drops — a refusal is acceptable behavior, not a crash). Both outcomes keep the library entry: a displayed image is a copy delivery, a refusal is a keep.
4. **File row → Explorer**
   - [ ] Open a collection, drag a row from the internal list to Explorer. Same expectations as the sheet drag (same-drive move-out toast; copy or different-drive keeps the entry).
5. **Cancel**
   - [ ] Start a drag and press Esc over the Desktop. Expected: nothing dropped, original untouched, no toast. The settle scans may run briefly behind the scenes but recycle nothing.

6. **Alt-drag (shortcut drop)**
   - [ ] Hold Alt and drag a sheet toward the Desktop / an Explorer window. Expected: a shortcut is made (or nothing transfers) — the original stays in the collection, no toast.
7. **Multi-file drag (native copy)**
   - [ ] Ctrl-select two rows in an open collection's list and drag them to the Desktop. Expected: two real files appear at the target and **both originals stay** in the collection (copy delivery: no recycle, no toast).

## B. Drag in (external → FolderDock)

6. **Explorer → collection card**
   - [ ] Drag 2–3 files from Explorer onto a specific folder card. Expected: toast reports the import (e.g. `3 moved into <name>`); the files sit inside that collection's real folder on disk and are **gone from their original location** on the same drive (drop-in is a move; a different drive is copied in and its source is recycled).
   - [ ] Repeat with a byte-identical copy of a file already in that card. Expected: skipped with an explanation toast — no ` (2)` duplicate.
   - [ ] Repeat with a same-name file whose content differs. Expected: imported as `<name> (2)`, nothing overwritten.
7. **Explorer → shelf background**
   - [ ] Drop files on the window background with a collection open. Expected: they are moved into the open collection (toast names it).
8. **FolderDock → FolderDock (self-drop via the import path)**
   - [ ] Drag a sheet from collection A and release it over collection B's card. Expected: the drop rides the import path like any Explorer drop — the file is **moved on disk** (disappears from A's directory, appears in B's) and a toast reports the move.
   - [ ] Drop a sheet back onto its own collection card. Expected: nothing moves; the importer explains it with an `Already in this collection.` toast.
   - [ ] Drop a FolderDock file onto the shelf background. Expected: nothing moves; a toast explains the file stayed (`Still in your library — drop onto a collection to move it`).

## C. Edge cases

- [ ] Drag a file onto a collection that already contains a file with the same name → collision-suffixed import (` (2)`), nothing overwritten.
- [ ] Preview modal open: the backdrop blocks the shelf, so internal drags are unavailable; move or delete the previewed file elsewhere and the modal closes gracefully.
- [ ] Drag a very large file (>200 MB) in from Explorer → skipped with a clear reason in the toast.
- [ ] While a drag is in progress, FolderDock shows the slim bottom hint bar; folder cards highlight on hover.
- [ ] Keyboard-only: Tab to a file row, press Enter (preview), F2 (rename), Del (delete confirm) — all without the mouse.

## Notes

- Drag imagery: every file drag now runs the native Electron drag (`startDrag`) with a per-type icon (Markdown/text/image/PDF/generic — `startDrag` only accepts image assets; documented in the implementation report). No HTML5 carrier remains, so Chromium no longer supplies drag imagery anywhere.
- Apps that accept only virtual content (not files) may ignore the drop; FolderDock cannot force them to accept. A refused or copy-delivered drop keeps the library original — the settle scan recycles only what the disk proves was moved.
- Automation boundary: E2E cannot drive real OS drag loops. With `FOLDERDOCK_E2E_NODRAG=1` the main process records what a drag would have carried instead of starting one (used by the E2E suite to verify the handoff); everything after a drop is filesystem logic, which the E2E move-out journey covers by deleting the file while the settle scan runs.
