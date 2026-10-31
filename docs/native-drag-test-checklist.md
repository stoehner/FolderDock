# Native Drag & Drop — Manual Windows Test Checklist

Automated tests cover the UI and filesystem logic, but true OS drag interactions need human hands. Run through this list after installing (or with `npm run dev`).

> **Behavior since v1.3.7 (checklist revised 2026-10-31):** single-file drag-out is a true **move out of the library** — the copy lands at the drop target, and once the drop settles the library original goes to the Recycle Bin. Explorer drop-in **moves** sources into the library (same drive; copied then source-recycled across drives). Multi-file drags out stay a plain copy. Alt/shortcut and cancelled drops keep the original.

## A. Drag out (FolderDock → external)

1. **Sheet → Explorer**
   - [ ] Open FolderDock, hover a folder, grab a visible paper sheet, drag it onto the Desktop / an Explorer window.
   - [ ] Expected: a real file appears at the drop location with correct name, extension and **readable content** (open the dropped `.md`/`.txt` in Notepad).
   - [ ] After a short settle window a toast reports `"name" moved out of the library · original went to the Recycle Bin`.
   - [ ] Final state: the file is at the drop location, no longer in the collection, and the original sits in the Recycle Bin (restore it to double-check content).
2. **Sheet → text editor** (VS Code or Notepad++)
   - [ ] Drag a `.md` sheet into the editor window. Expected: the editor opens and shows the real file content (no plain-text blob, no shortcut).
   - [ ] The library original should leave the collection once the drop settles. If the editor holds a hard lock on the file, a visible recycle-error toast with the original kept is acceptable — note which behavior you saw; nothing should be lost either way.
3. **Sheet → browser**
   - [ ] Drag an image sheet into a Chrome/Edge window. Expected: the browser displays/accepts the image (many, not all, apps accept type-specific drops — a refusal is acceptable behavior, not a crash).
4. **File row → Explorer**
   - [ ] Open a collection, drag a row from the internal list to Explorer. Same expectations as sheet drag.
5. **Cancel**
   - [ ] Start a drag and press Esc over the Desktop. Expected: nothing dropped, original untouched, FolderDock still responsive.

6. **Alt-drag (shortcut drop)**
   - [ ] Hold Alt and drag a sheet toward the Desktop / an Explorer window. Expected: no file transfer — the original stays in the collection (FolderDock only retires it when the OS reports the file itself was delivered).
7. **Multi-file drag (native copy)**
   - [ ] Ctrl-select two rows in an open collection's list and drag them to the Desktop. Expected: two real files appear at the target and **both originals stay** in the collection (multi-selection keeps the native Electron copy drag).

## B. Drag in (external → FolderDock)

6. **Explorer → collection card**
   - [ ] Drag 2–3 files from Explorer onto a specific folder card. Expected: toast reports the import (e.g. `3 moved into <name>`); the files sit inside that collection's real folder on disk and are **gone from their original location** on the same drive (drop-in is a move; a different drive is copied in and its source is recycled).
   - [ ] Repeat with a byte-identical copy of a file already in that card. Expected: skipped with an explanation toast — no ` (2)` duplicate.
   - [ ] Repeat with a same-name file whose content differs. Expected: imported as `<name> (2)`, nothing overwritten.
7. **Explorer → shelf background**
   - [ ] Drop files on the window background with a collection open. Expected: they are moved into the open collection (toast names it).
8. **FolderDock → FolderDock (self-drop)**
   - [ ] Drag a sheet from collection A and release it over collection B's card. Expected: the file is **moved** on disk (disappears from A's directory, appears in B's).
   - [ ] Drop a sheet back onto its own collection card. Expected: no-op, no error, no duplicate.
   - [ ] Drop a FolderDock file onto the shelf background. Expected: nothing moves; a toast explains the file stayed in its collection.

## C. Edge cases

- [ ] Drag a file onto a collection that already contains a file with the same name → collision-suffixed import (` (2)`), nothing overwritten.
- [ ] Preview modal open: the backdrop blocks the shelf, so internal drags are unavailable; move or delete the previewed file elsewhere and the modal closes gracefully.
- [ ] Drag a very large file (>200 MB) in from Explorer → skipped with a clear reason in the toast.
- [ ] While a drag is in progress, FolderDock shows the slim bottom hint bar; folder cards highlight on hover.
- [ ] Keyboard-only: Tab to a file row, press Enter (preview), F2 (rename), Del (delete confirm) — all without the mouse.

## Notes

- Drag imagery: multi-selection drags run the native Electron drag with a per-type icon (Markdown/text/image/PDF/generic — `startDrag` only accepts image assets; documented in the implementation report). Single-file drags are carried by the HTML5 `DownloadURL` flavour naming the real `file://` path; Chromium supplies their drag imagery.
- Apps that accept only virtual content (not files) may ignore the drop; FolderDock cannot force them to accept.
