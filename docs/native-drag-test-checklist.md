# Native Drag & Drop — Manual Windows Test Checklist

Automated tests cover the UI and filesystem logic, but true OS drag interactions need human hands. Run through this list after installing (or with `npm run dev`).

> **Behavior since 2026-11-02 (intent resolved keep verdict; supersedes the 2026-11-01 wording):** the Electron carrier delivers **copies only** — it starts the OLE drag with allowed operations copy | link (`drag_util_views.cc` line 47) and `startDrag` has no parameter to offer move, so Windows never moves a file out of an app source; every external drop lands as a copy on any drive. The settle scan chain still reads the disk (first scan 1.2 s after the drag starts, up to 3 scans over ~10 s): a file gone from the library and listed in no other collection = a real move-away (Recycle-bin target, future carrier) → the entry is applied and a toast reports `"name" moved out of the library`. A file still present at the settle cap = keep, and the user's declared intent resolves it: **plain drag** = keep + one educational toast naming Shift; **Ctrl / Alt / multi-selection** = silent keep (explicit copy/shortcut intent); **Shift** = confirm modal (`Move out of the library?`) — confirm recycles the library copy into the Recycle Bin (recoverable) with the same `"moved out"` toast, Cancel keeps silently. Nothing recycles unless the user clicks confirm. Dragging back onto a FolderDock surface rides the import path (importer toasts apply).

## A. Drag out (FolderDock → external)

1. **Sheet → Explorer, plain drag (copy delivery)**
   - [ ] Open FolderDock, hover a folder, grab a visible paper sheet, drag it onto the Desktop / an Explorer window (any drive).
   - [ ] Expected: the target receives a real copy with correct name, extension and **readable content** (open the dropped `.md`/`.txt` in Notepad); the library entry **stays**.
   - [ ] About 10 s after the release, one toast appears: `"name" is still in your library — hold Shift while dragging to move it out`. No modal, nothing recycled, no second toast afterwards.
2. **Sheet → Explorer, Shift drag (move request)**
   - [ ] Hold **Shift** and drag the same sheet onto the Desktop / an Explorer window.
   - [ ] Expected: the target again receives a copy; ~10 s after the release a modal opens: `Move out of the library?` / `"name" is still in the library`.
   - [ ] Confirm (`Move it out`): the library sheet leaves the collection, the library copy goes to the **Recycle Bin** (restorable), and a toast reports `"name" moved out of the library`.
   - [ ] Repeat and press **Cancel** (or the ✕ / Esc): the modal closes, the original stays in the collection, Recycle Bin untouched, no toast.
3. **Sheet → text editor** (VS Code or Notepad++)
   - [ ] Drag a `.md` sheet into the editor window. Expected: the editor opens and shows the real file content (no plain-text blob, no shortcut).
   - [ ] Expected: the library entry **stays** with the plain-drag educational toast above (editors take a copy/reference, not a move). With a Shift drag the same vanish-confirm modal appears — confirm only if you actually want the library copy gone; note the editor may hold a file lock, and if recycling then fails the library copy stays with an error toast.
4. **Sheet → browser**
   - [ ] Drag an image sheet into a Chrome/Edge window. Expected: the browser displays/accepts the image (many, not all, apps accept type-specific drops — a refusal is acceptable behavior, not a crash). Either outcome keeps the library entry; a plain drag also shows the educational toast at the settle cap, a Shift drag opens the modal.
5. **Cancel mid-drag (Esc)**
   - [ ] Start a drag and press Esc over the Desktop. Expected: nothing dropped, original untouched. A **plain** drag still shows the educational toast at the settle cap (the disk cannot tell a cancelled drag from a copy delivery); a **Shift** drag opens the confirm modal — Decline to keep, Confirm would recycle (intented, recoverable).
6. **Alt-drag (shortcut drop)**
   - [ ] Hold Alt and drag a sheet toward the Desktop / an Explorer window. Expected: a shortcut is made (or nothing transfers) — the original stays in the collection, **no toast ever** (Alt = explicit shortcut intent, silent keep).
7. **Ctrl-drag (explicit copy)**
   - [ ] Hold Ctrl and drag a sheet to the Desktop. Expected: a copy appears at the target, the library entry stays — **silent** (no educational toast; the user explicitly asked for a copy).
8. **Multi-file drag (native copy)**
   - [ ] Ctrl-select two rows in an open collection's list and drag them to the Desktop. Expected: two real files appear at the target and **both originals stay** in the collection — silent, no settle chain runs for multi-drag.

## B. Refusing and unusual targets

1. **Target refuses the drop**
   - [ ] Drag a sheet onto an app window that accepts only non-file content (or a browser page mid-reload). Expected: nothing transfers, the original stays with the plain-drag educational toast / Shift modal — identical to other keeps; refusing targets are indistinguishable to the app, which is why nothing ever recycles automatically.
2. **Recycle Bin as the drop target**
   - [ ] Drag a sheet from FolderDock straight onto the Recycle Bin icon. Expected: Windows actually moves the file into the bin — the settle scan finds it gone from the library and listed nowhere, the sheet leaves the collection, and the toast reports `"name" moved out of the library`. This is the one target that genuinely moves out of an Electron app source; no modal appears and no Shift is needed.

## C. Drag in (external → FolderDock)

1. **Explorer → collection card**
   - [ ] Drag 2–3 files from Explorer onto a specific folder card. Expected: toast reports the import (e.g. `3 moved into <name>`); the files sit inside that collection's real folder on disk and are **gone from their original location** on the same drive (drop-in is a move; a different drive is copied in and its source is recycled).
   - [ ] Repeat with a byte-identical copy of a file already in that card. Expected: skipped with an explanation toast — no ` (2)` duplicate.
   - [ ] Repeat with a same-name file whose content differs. Expected: imported as `<name> (2)`, nothing overwritten.
2. **Explorer → shelf background**
   - [ ] Drop files on the window background with a collection open. Expected: they are moved into the open collection (toast names it).
3. **FolderDock → FolderDock (self-drop via the import path)**
   - [ ] Drag a sheet from collection A and release it over collection B's card. Expected: the drop rides the import path like any Explorer drop — the file is **moved on disk** (disappears from A's directory, appears in B's) and a toast reports the move.
   - [ ] Drop a sheet back onto its own collection card. Expected: nothing moves; the importer explains it with an `Already in this collection.` toast.
   - [ ] Drop a FolderDock file onto the shelf background. Expected: nothing moves; a toast explains the file stayed (`Still in your library — drop onto a collection to move it`).

## D. Edge cases

- [ ] **Quiet retarget masks a move-out**: have file `same.md` in two collections (A and B), then drag A's copy onto a Recycle-bin target. Expected: the scan sees the basename still "listed" (B owns it), retires A's entry quietly with **no** `"moved out"` toast — the name-based retarget rule is cosmetic and the disk is still the truth.
- [ ] **Long drag hold**: hold an out-drag at the target longer than ~13 s before releasing (Shift drag). Expected: the copy still arrives and the confirm modal still resolves the library copy — but do not build workflows on very long holds; the scan chain caps at ~10 s and later verifications are the modal's job.
- [ ] Same-name collision on import, large-file (>200 MB) skip, preview-modal backdrop blocking internal drags, and the drag hint bar: unchanged from the previous checklist — one check each:
- [ ] Drag a file (in) onto a collection that already contains a file with the same name → collision-suffixed import (` (2)`), nothing overwritten.
- [ ] Drag a very large file (>200 MB) in from Explorer → skipped with a clear reason in the toast.
- [ ] While a drag is in progress, FolderDock shows the slim bottom hint bar; folder cards highlight on hover.
- [ ] Keyboard-only: Tab to a file row, press Enter (preview), F2 (rename), Del (delete confirm) — all without the mouse.

## Notes

- Upstream citation (2026-11-02): Electron v44.10.1 `shell/browser/ui/drag_util_views.cc` line 47 — `DragFileItems` starts the Windows drag with `ui::DragDropTypes::DRAG_COPY | ui::DragDropTypes::DRAG_LINK`; `WebContents::StartDrag` accepts only `file`/`files`/`icon`, so no API surface can add `DRAG_MOVE`. FolderDock therefore cannot make Windows move a file out; it can only retire the library copy on the user's explicit say-so (Shift + confirm), which is recoverable via the Recycle Bin.
- Drag imagery: every file drag runs the native Electron drag (`startDrag`) with a per-type icon (Markdown/text/image/PDF/generic — `startDrag` only accepts image assets; documented in the implementation report). No HTML5 carrier remains, so Chromium no longer supplies drag imagery anywhere.
- Apps that accept only virtual content (not files) may ignore the drop; FolderDock cannot force them to accept. Whatever the target does — accept, refuse, or cancel — the library original survives the settle scans; only the Shift modal's own confirm click (or a real move-away such as a Recycle-bin drop) removes it.
- Automation boundary: E2E cannot drive real OS drag loops. Journeys fire the internal script-drag helper (`shiftKey` supported) and cover the full keep/teach/modal/decline/real-move ladder; with `FOLDERDOCK_E2E_NODRAG=1` the main process records what a drag would have carried instead of starting one.
