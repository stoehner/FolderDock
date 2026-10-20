# Native Drag & Drop — Manual Windows Test Checklist

Automated tests cover the UI and filesystem logic, but true OS drag interactions need human hands. Run through this list after installing (or with `npm run dev`).

## A. Drag out (FolderDock → external)

1. **Sheet → Explorer**
   - [ ] Open FolderDock, hover a folder, grab a visible paper sheet, drag it onto the Desktop / an Explorer window.
   - [ ] Expected: a real file appears at the drop location with correct name, extension and **readable content** (open the dropped `.md`/`.txt` in Notepad).
   - [ ] The original file is still in the FolderDock collection afterwards.
2. **Sheet → text editor** (VS Code or Notepad++)
   - [ ] Drag a `.md` sheet into the editor window. Expected: the editor opens the real file (path resolves; no plain-text blob).
3. **Sheet → browser**
   - [ ] Drag an image sheet into a Chrome/Edge window. Expected: the browser displays/accepts the image (many, not all, apps accept type-specific drops — a refusal is acceptable behavior, not a crash).
4. **File row → Explorer**
   - [ ] Open a collection, drag a row from the internal list to Explorer. Same expectations as sheet drag.
5. **Cancel**
   - [ ] Start a drag and press Esc over the Desktop. Expected: nothing dropped, original untouched, FolderDock still responsive.

## B. Drag in (external → FolderDock)

6. **Explorer → collection card**
   - [ ] Drag 2–3 files from Explorer onto a specific folder card. Expected: toast reports “N copied into <name>”; files exist on disk inside that collection's real folder; duplicate names get ` (2)` suffixes.
7. **Explorer → shelf background**
   - [ ] Drop files on the window background with a collection open. Expected: they are copied into the open collection (toast names it).
8. **FolderDock → FolderDock (self-drop)**
   - [ ] Drag a sheet from collection A and release it over collection B's card. Expected: the file is **moved** on disk (disappears from A's directory, appears in B's).
   - [ ] Drop a sheet back onto its own collection card. Expected: no-op, no error, no duplicate.
   - [ ] Drop a FolderDock file onto the shelf background. Expected: nothing moves; a toast explains the file stayed in its collection.

## C. Edge cases

- [ ] Drag a file onto a collection that already contains a file with the same name → collision-suffixed copy, no overwrite.
- [ ] Preview modal open: the backdrop blocks the shelf, so internal drags are unavailable; move or delete the previewed file elsewhere and the modal closes gracefully.
- [ ] Drag a very large file (>200 MB) in from Explorer → skipped with a clear reason in the toast.
- [ ] While a drag is in progress, FolderDock shows the slim bottom hint bar; folder cards highlight on hover.
- [ ] Keyboard-only: Tab to a file row, press Enter (preview), F2 (rename), Del (delete confirm) — all without the mouse.

## Notes

- Drag imagery is a type icon (Markdown/text/image/PDF/generic), not a live file thumbnail — this is an Electron `startDrag` limitation documented in the implementation report.
- Apps that accept only virtual content (not files) may ignore the drop; FolderDock cannot force them to accept.
