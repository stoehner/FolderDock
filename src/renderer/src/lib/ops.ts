import { api, call, errText, pathInsideRoot } from './api'
import { useLibrary } from '../state/library'
import { usePrefs } from '../state/prefs'
import { targetFolderForNewItems, useUI } from '../state/ui'
import type { ImportResult } from '../../../shared/types'

function adoptError(e: unknown): string {
  return errText(e)
}

export async function createFolderOp(name: string, art: string): Promise<boolean> {
  const ui = useUI.getState()
  try {
    const snap = await call(api.createFolder(name))
    useLibrary.getState().apply(snap)
    ui.setFolderArt(name, art)
    ui.setOpenFolder(name)
    ui.closeModal()
    ui.notify(`Collection "${name}" created`)
    return true
  } catch (e) {
    ui.notify(adoptError(e), 'error')
    return false
  }
}

export async function renameFolderOp(oldName: string, newName: string): Promise<boolean> {
  const ui = useUI.getState()
  try {
    const snap = await call(api.renameFolder(oldName, newName))
    useLibrary.getState().apply(snap)
    ui.rekeyFolder(oldName, newName)
    ui.closeModal()
    ui.notify('Collection renamed')
    return true
  } catch (e) {
    ui.notify(adoptError(e), 'error')
    return false
  }
}

export async function deleteFolderOp(name: string): Promise<void> {
  const ui = useUI.getState()
  try {
    const snap = await call(api.deleteFolder(name))
    useLibrary.getState().apply(snap)
    ui.closeModal()
    if (useUI.getState().openFolder === name) ui.setOpenFolder(null)
    ui.notify(`"${name}" moved to the Recycle Bin`)
  } catch (e) {
    ui.notify(adoptError(e), 'error')
  }
}

export async function renameFileOp(relPath: string, newName: string): Promise<boolean> {
  const ui = useUI.getState()
  try {
    const snap = await call(api.renameFile(relPath, newName))
    useLibrary.getState().apply(snap)
    ui.closeModal()
    ui.notify('File renamed')
    return true
  } catch (e) {
    ui.notify(adoptError(e), 'error')
    return false
  }
}

export async function moveFilesOp(relPaths: string[], targetFolder: string): Promise<void> {
  const ui = useUI.getState()
  let moved = 0
  for (const relPath of relPaths) {
    try {
      const snap = await call(api.moveFile(relPath, targetFolder))
      useLibrary.getState().apply(snap)
      moved += 1
    } catch (e) {
      ui.notify(adoptError(e), 'error')
    }
  }
  ui.closeModal()
  useUI.getState().clearSelection()
  if (moved > 0) ui.notify(`${moved} file${moved === 1 ? '' : 's'} moved into ${targetFolder}`)
}

export async function deleteFilesOp(relPaths: string[]): Promise<void> {
  const ui = useUI.getState()
  if (ui.previewRelPath && relPaths.includes(ui.previewRelPath ?? '')) ui.closePreview()
  for (const relPath of relPaths) {
    try {
      const snap = await call(api.deleteFile(relPath))
      useLibrary.getState().apply(snap)
    } catch (e) {
      ui.notify(adoptError(e), 'error')
    }
  }
  useUI.getState().closeModal()
  useUI.getState().clearSelection()
  ui.notify(`${relPaths.length} file${relPaths.length === 1 ? '' : 's'} moved to the Recycle Bin`)
}

export async function moveOutOp(relPath: string): Promise<void> {
  const ui = useUI.getState()
  try {
    const dir = await call(api.chooseMoveOut())
    if (!dir) return
    const { result, snapshot } = await call(api.moveFileOut(relPath, dir))
    useLibrary.getState().apply(snapshot)
    const leaf = dir.split(/[\\/]/).filter(Boolean).pop() ?? dir
    if (result.sourceKept) {
      ui.notify(`"${result.name}" copied to ${leaf} — the library copy stays because it could not be recycled`, 'error')
    } else {
      ui.notify(`"${result.name}" moved out of FolderDock to ${leaf}`)
    }
  } catch (e) {
    ui.notify(adoptError(e), 'error')
  }
}

export type SaveOutcome = 'saved' | 'conflict' | 'invalid-name'

export async function saveEditorOp(): Promise<SaveOutcome> {
  const ui = useUI.getState()
  const ed = ui.editor
  if (!ed) return 'saved'
  const name = ed.name.trim()
  if (!name) {
    ui.notify('Enter a file name.', 'error')
    return 'invalid-name'
  }
  try {
    const res = await call(
      api.writeTextFile({ relPath: ed.relPath, content: ed.content, expectedMtimeMs: ed.mtimeMs, hadBom: ed.hadBom })
    )
    if (!res.saved) {
      return 'conflict'
    }
    useUI.setState(s => (s.editor ? { editor: { ...s.editor, mtimeMs: res.mtimeMs, savedContent: s.editor.content } } : {}))
    ui.notify('File saved')
    return 'saved'
  } catch (e) {
    ui.notify(adoptError(e), 'error')
    return 'invalid-name'
  }
}

export async function overwriteEditorOp(): Promise<void> {
  const ed = useUI.getState().editor
  if (!ed) return
  try {
    const res = await call(
      api.writeTextFile({ relPath: ed.relPath, content: ed.content, expectedMtimeMs: null, hadBom: ed.hadBom })
    )
    if (res.saved) {
      useUI.setState(s => (s.editor ? { editor: { ...s.editor, mtimeMs: res.mtimeMs, savedContent: s.editor.content } } : {}))
      useUI.getState().notify('File saved (disk version replaced)')
      useUI.getState().closeModal()
    }
  } catch (e) {
    useUI.getState().notify(adoptError(e), 'error')
  }
}

export async function reloadEditorOp(): Promise<void> {
  const ed = useUI.getState().editor
  if (!ed) return
  try {
    const file = await call(api.readTextFile(ed.relPath))
    if (file.binary) {
      useUI.getState().notify('The file on disk looks binary now.', 'error')
      return
    }
    useUI.setState(s =>
      s.editor
        ? { editor: { ...s.editor, content: file.content, savedContent: file.content, mtimeMs: file.mtimeMs, hadBom: file.hadBom } }
        : {}
    )
    useUI.getState().notify('Loaded the latest version from disk')
    useUI.getState().closeModal()
  } catch (e) {
    useUI.getState().notify(adoptError(e), 'error')
  }
}

export async function createNoteOp(folder?: string): Promise<void> {
  const ui = useUI.getState()
  const target = folder ?? targetFolderForNewItems()
  if (!target) {
    ui.notify('Create a collection first.', 'error')
    return
  }
  try {
    const note = await call(api.createNote(target))
    await useLibrary.getState().refresh()
    useUI.getState().setOpenFolder(target)
    await useUI.getState().openEditor(note.relPath)
  } catch (e) {
    ui.notify(adoptError(e), 'error')
  }
}

function importSummary(r: ImportResult, target: string): void {
  const ui = useUI.getState()
  const parts: string[] = []
  if (r.imported.length) parts.push(`${r.imported.length} copied`)
  if (r.moved.length) parts.push(`${r.moved.length} moved`)
  const ok = r.imported.length + r.moved.length
  if (ok > 0) {
    ui.notify(`${parts.join(' · ')} into ${target}${r.skipped.length ? ` · ${r.skipped.length} skipped` : ''}`)
  } else if (r.skipped.length > 0) {
    const more = r.skipped.length - 1
    const first = r.skipped[0]?.reason ?? 'Nothing imported.'
    ui.notify(more > 0 ? `${first} (${more} more skipped)` : first, 'error')
  } else {
    ui.notify('Nothing to do — files are already in place.')
  }
}

export async function importDropOp(paths: string[], targetFolder: string): Promise<void> {
  const ui = useUI.getState()
  try {
    const r = await call(api.dropFiles(paths, targetFolder))
    importSummary(r, targetFolder)
    await useLibrary.getState().refresh()
  } catch (e) {
    ui.notify(adoptError(e), 'error')
  }
}

export async function chooseImportOp(targetFolder?: string): Promise<void> {
  const ui = useUI.getState()
  const target = targetFolder ?? targetFolderForNewItems()
  if (!target) {
    ui.notify('Create a collection first.', 'error')
    return
  }
  try {
    const r = await call(api.chooseAndImport(target))
    importSummary(r, target)
    await useLibrary.getState().refresh()
  } catch (e) {
    ui.notify(adoptError(e), 'error')
  }
}

export async function dropBackgroundOp(paths: string[]): Promise<void> {
  const root = useLibrary.getState().snapshot?.root ?? ''
  const internal = paths.filter(p => pathInsideRoot(root, p))
  const external = paths.filter(p => !pathInsideRoot(root, p))
  if (external.length > 0) {
    await importDropOp(external, targetFolderForNewItems() ?? 'Unsorted')
    return
  }
  if (internal.length > 0) {
    useUI.getState().notify('Still in your library — drop onto a collection to move it')
  }
}

export async function revealOp(relPath: string): Promise<void> {
  try {
    await call(api.revealFile(relPath))
  } catch (e) {
    useUI.getState().notify(adoptError(e), 'error')
  }
}

export async function openExternalOp(relPath: string): Promise<void> {
  try {
    await call(api.openFileExternal(relPath))
  } catch (e) {
    useUI.getState().notify(adoptError(e), 'error')
  }
}

export async function copyTextOp(relPath: string): Promise<void> {
  const ui = useUI.getState()
  try {
    const file = await call(api.readTextFile(relPath))
    await navigator.clipboard.writeText(file.content)
    ui.notify('Contents copied to the clipboard')
  } catch (e) {
    ui.notify(adoptError(e), 'error')
  }
}

export function requestCloseEditor(): void {
  const ui = useUI.getState()
  const ed = ui.editor
  if (!ed) return
  if (ed.content === ed.savedContent) {
    ui.closeEditor()
    return
  }
  ui.openModal({
    type: 'confirm',
    title: 'Discard unsaved changes?',
    subtitle: ed.name,
    description: 'The editor has changes that have not been saved to disk. Discarding keeps the file on disk unchanged.',
    confirmLabel: 'Discard changes',
    onConfirm: () => useUI.getState().closeEditor(),
    onCancel: () => useUI.getState().openModal({ type: 'editor', relPath: ed.relPath })
  })
}

export function promptDeleteFiles(relPaths: string[]): void {
  if (!usePrefs.getState().prefs.confirmDelete) {
    void deleteFilesOp(relPaths)
    return
  }
  const names = relPaths.map(p => p.split('/').pop() ?? p)
  const shown = names.slice(0, 3).join(', ')
  useUI.getState().openModal({
    type: 'confirm',
    title: relPaths.length === 1 ? 'Delete document?' : `Delete ${relPaths.length} files?`,
    subtitle: names.length > 3 ? `${shown}, +${names.length - 3} more` : names[0] ?? '',
    description:
      relPaths.length === 1
        ? 'The file is moved to the Windows Recycle Bin. You can restore it there if needed.'
        : 'These files are moved to the Windows Recycle Bin. You can restore them there if needed.',
    confirmLabel: 'Move to Recycle Bin',
    onConfirm: () => deleteFilesOp(relPaths)
  })
}

export function promptDeleteFolder(name: string, fileCount: number): void {
  if (!usePrefs.getState().prefs.confirmDelete) {
    void deleteFolderOp(name)
    return
  }
  useUI.getState().openModal({
    type: 'confirm',
    title: 'Delete collection?',
    subtitle: name,
    description: `This removes the folder and its ${fileCount} file${fileCount === 1 ? '' : 's'} from disk, moving it to the Recycle Bin.`,
    confirmLabel: 'Move to Recycle Bin',
    onConfirm: () => deleteFolderOp(name)
  })
}
