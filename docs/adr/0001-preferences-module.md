# ADR-0001: Settings live behind the preferences module seam; library view state stays in the session store

Date: 2026-10-18
Status: Accepted

## Context

Adding a preference used to cost six aligned edits across three modules (the `Prefs` type, `DEFAULT_PREFS`, `mergePrefs`, the ui-state field, the persistence whitelist, and the boot mapping). The 2026-10-18 feature batch added six preferences and paid the tax each time. An architecture review proposed deepening the pipeline; a grilling round settled the design.

## Decision

- All **settings** (theme, alwaysOnTop, viewSize, fileSort, closeToTray, confirmDelete, hoverDelay) are owned by one deep module, `src/renderer/src/state/prefs.ts`. Its interface is `boot`, `patch`, `setTheme`, `setViewSize`. It owns hydration, the debounced `prefs:set` IPC, the `body.light` / `body.compact` consequences, and the `prefers-color-scheme` listener. Callers cannot forget the DOM side effects.
- **Library view state** (folderOrder, folderArt, starred, openFolder) deliberately does **not** move. It is mutated constantly by interactions, is tied to snapshot contents, and is pruned by the main process. It stays in the session store with its own persistence patch.
- Orphaned library view state (entries naming collections that no longer exist) is pruned by the main process inside the `library:scan` handler via `prunePrefs`, not in the rename/delete handlers, so it cannot race the renderer's rename rekey.

## Consequences

- A new setting costs: one field in `Prefs`, one validator in `mergePrefs`, one key in the module's `SETTINGS_KEYS`. Defaults stay compiler-enforced.
- Two debounced persistence paths exist (settings module and session store). Both send partial patches; the main store merges. This is accepted: the alternative is moving high-churn library state behind a low-churn settings interface.
- Do not re-propose moving starred/folderOrder/folderArt/openFolder into the preferences module; the churn profile is the load-bearing reason they stayed.
