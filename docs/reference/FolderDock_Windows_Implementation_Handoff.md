# FolderDock — Windows Desktop Build Handoff

> **Use this instruction with the attached `FolderDock_Interactive_v2.html` file and the original 21st.dev Glass Folder Cards TSX source.** The HTML is the authoritative **interaction and visual reference**, not a filesystem implementation. Preserve its look and gestures, replacing browser-only simulation with secure native Windows integration.

## Your role

Act as a senior Windows desktop engineer and expert React/TypeScript UI developer. Build a production-quality **local-first Windows 11 desktop application** called FolderDock. Do not build a website or a fake filesystem. Read the attached HTML before writing implementation code. Preserve the overall design closely unless a genuine OS constraint requires an adjustment, and document such departures.

## Product definition

FolderDock is a compact, tall, resizable personal file shelf. By default, use approximately **660 × 890 CSS pixels**, with **two animated glass folders per row** and vertical scrolling. It should be possible to keep it open beside VS Code, Notepad, a browser, or another Windows application. Support light and dark themes. No login, cloud connection, server, or paid service should be required.

The UI is inspired by the **Glass Folder Cards** component at https://21st.dev/?preview=%2F%40kedhareswer%2Fcomponents%2Fglass-folder-cards. The original React component is a visual starting point, *not* a file manager. Its documents are currently mock elements and its Add action updates React state; do not mistake these for disk-backed operations.

## Preferred implementation stack

- Electron + React + TypeScript + Vite.
- Tailwind CSS + shadcn/ui for surrounding controls as helpful.
- Use the original glass folder concept and the supplied HTML prototype as styling/interaction references. Rebuild in React with reusable, typed components.
- Electron **main process** owns filesystem operations and starts native file drag using `webContents.startDrag({ file, icon })` or the supported multi-file signature for the installed Electron version. Verify exact API usage and Windows behavior in the chosen Electron release.
- Electron preload uses a **minimal allowlisted, strongly typed IPC bridge**. Keep `contextIsolation: true`, `nodeIntegration: false`, and suitable sandbox/security settings. Do not expose unrestricted Node.js APIs to the renderer.

## Core behavior: folders

1. Display two large folder objects side by side, scrolling downward through any number of collections.
2. Clicking the actual **frosted folder front** opens or closes that folder in place. The folder should grow vertically and reveal its contained files **inside the animated folder**, not navigate to a separate view.
3. When a folder has **one or two items**, show exactly one or two named paper sheets visibly tucked behind the front. When it has three or more, show up to three individually identifiable sheets; the complete folder contents are available in its internal scrollable list.
4. The visible sheets must represent **real file records**. Their displayed name, type, and drag payload must match the underlying file.
5. The **exposed part of each paper sheet** is clickable and draggable. The lower glass front remains the click target for opening the folder; avoid overlapping drag hit zones with the front panel. Hover/focus raises and separates papers enough to grab them easily.
6. Provide create, rename, delete, reorder, import, and move operations. Prompt before destructive deletes and show errors without losing data.

## Core behavior: native drag-out (non-negotiable)

- The user can **grab a paper sheet directly from an animated folder** and drag that *real file* into Windows Explorer or any third-party app that accepts that file type. This must work without first opening the folder's file list or a separate dialog.
- The scrollable file-list rows must support the same drag-out operation.
- For drag-out, resolve the canonical existing path to the selected file and call the native Electron drag API from the main process. Do not substitute HTML5 `dataTransfer.setData`, a filename string, a blob URL, or a browser download for native Windows dragging.
- A dragged Markdown/text file must remain a real `.md` / `.txt` file; images remain real PNG/JPEG/WebP/etc., and PDFs remain PDFs. Do not silently flatten files into plain text.
- Dragging into another folder **within FolderDock** moves that file through real filesystem operations; dragging out to an external program must **not delete or move the original** unless the user explicitly performs a move operation.
- Support drop-in from Windows Explorer. Copy or move semantics must be clear and safe. Validate filename collisions and permissions.
- If a target application does not accept a file type, handle the failed/ignored drop gracefully. Do not claim universal compatibility with all applications.
- The browser HTML displays a **simulated external application drop zone** only so the concept can be tested. **Remove this simulation** when native Windows drag-out has been implemented and validated.

## Hover summaries and full file preview: build BOTH

**A. Quick hover summary.** On hovering/focusing a named paper sheet or file row for about 250 ms, show a restrained floating tooltip with filename, type, parent folder, and a brief description. For text and Markdown, derive an excerpt from real content (e.g. first meaningful heading/body, stripped of Markdown syntax). For images/PDFs, show type, size, and useful available metadata; avoid made-up summaries or uploading content anywhere.

**B. On-click side preview.** Clicking a paper or file row opens a separate, dismissible **sidecar panel to the right of the narrow shelf** on a roomy display. It displays the **actual file**, not dummy lorem ipsum. For Markdown, render safe formatted Markdown; for text, show plain text; for screenshots, show the actual image; for PDFs, render document pages in a sandboxed/secure preview. Include Open/Edit, Copy (where relevant), Export/Open in Explorer, and Close. On narrow displays, let the preview overlay the shelf instead of widening it. Closing the preview must not close or reset an open folder.

Use **double click** or the explicit Edit action to open the full Markdown/text editor. Escape closes the topmost UI surface. Ensure tooltips are noninteractive and do not block dragging.

## Filesystem and persistence

- Make actual files and directories the source of truth, rooted initially at a user-visible folder such as `Documents/FolderDock`, with an option to select/change the root folder later.
- Do not store file contents exclusively in a React state array, IndexedDB, SQLite, or localStorage. Those may be used for **UI-only preferences** (order, color, pinned items, window geometry, theme, last open folder).
- Use stable IDs independent of filenames where needed for UI identity; reflect real renames, external edits, deletes, and file additions through filesystem watching or an explicit refresh.
- Use safe, atomic writes for text editing; respect file encodings and warn on external concurrent modifications. Handle save failures clearly.
- Never execute imported files. Sanitize Markdown output; display SVG as an image without executing embedded scripting; secure PDF handling and never trust imported filenames or paths.

## Existing functionality to retain from HTML

Search/filter by filename, category, and starred status; create Markdown quick note; in-folder scrolling; light and dark themes; named/colored folders; folder reordering through dedicated handle; context menus; file import; edit/preview modes; export; keyboard navigation; useful tooltips. The UI may remain compact rather than overloading each card with buttons.

## Implementation sequence

1. Scaffold an Electron + React + TypeScript application, packageable for Windows 11. Add secure typed IPC and real file APIs before embellishing animation.
2. Implement the disk-backed library store, reading/writing/importing/renaming/deleting/moving files and folders, plus error handling.
3. Port/reproduce the glass folder card with **individually draggable file-sheet components**, respecting 0 / 1 / 2 / 3+ visible sheets and separate front-click hit area.
4. Implement native drag-out and drag-in. **Test drag-out with an actual file** to Explorer and a compatible external editor before proceeding.
5. Implement 250-ms hover excerpts, sidecar preview for `.md`, `.txt`, images and PDFs, and a Markdown editor.
6. Add search, organization, themes, keyboard shortcuts, settings, tests, and Windows build/installer.
7. Test user journeys end-to-end on Windows; compare the rendered application visually to the supplied HTML.

## Required acceptance tests

- A one-file folder shows exactly one named sheet; two-file folder shows exactly two. Either sheet can be grabbed without first opening the folder.
- Clicking the frosted front opens an internal file list; clicking an exposed page does not inadvertently open/close the folder.
- Drag `.md` from the visible paper directly to Explorer: a **real, readable file** appears in the drop target. Drag to a compatible editor and verify behavior.
- Drop a PNG or PDF from Explorer into FolderDock, restart app, preview its real content, and drag it back out.
- Hover sheets and file rows: summary appears after short delay and dismisses on leave/drag. Click: real side preview appears. Edit/save: on-disk bytes change and the preview updates.
- Move file from Folder A to Folder B; verify filesystem paths, folder counts, order and drag behavior.
- Restart, resize, rename, delete, restore session. No loss of actual files or unexpected operations.
- Verify security: renderer cannot pass arbitrary filesystem paths or execute untrusted imported content.

## Deliverables

1. Working Electron source project, install/run/build instructions, Windows distributable.
2. Reusable UI components and fully typed interfaces.
3. Automated tests for file operations, preview behavior, and key UI interactions; a concise manual Windows native drag/drop test checklist.
4. README explaining browser-demo versus native behavior and where real files live.
5. A brief implementation report with any limitations, unsupported drop targets, and decisions made.

**Do not declare the project complete because the mockup looks right. Completion requires real on-disk files and tested native drag from the exposed paper sheets into compatible Windows applications.**
