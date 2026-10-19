import { useEffect, useRef } from 'react'
import { isTextKind, kindForExt } from '../../../shared/kinds'
import { api } from '../lib/api'
import { ico } from '../lib/icons'
import { useUI, type ContextMenu as ContextMenuState } from '../state/ui'
import { useLibrary } from '../state/library'
import {
  chooseImportOp,
  copyTextOp,
  createNoteOp,
  openExternalOp,
  promptDeleteFile,
  promptDeleteFolder,
  revealOp
} from '../lib/ops'

interface Item {
  label: string
  icon: string
  danger?: boolean
  run: () => void
}

const MENU_HEIGHT_ESTIMATE = 380

export function ContextMenu() {
  const menu = useUI(s => s.contextMenu)
  const closeMenu = useUI(s => s.closeMenu)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeMenu()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeMenu()
    }
    const onOther = (): void => closeMenu()
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('wheel', onOther, { capture: true, passive: true })
    window.addEventListener('resize', onOther)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('wheel', onOther, { capture: true } as EventListenerOptions)
      window.removeEventListener('resize', onOther)
    }
  }, [menu, closeMenu])

  if (!menu) return null

  const snapshot = useLibrary.getState().snapshot
  const items = buildItems(menu, snapshot)

  const width = 190
  const x = Math.max(10, Math.min(menu.x, window.innerWidth - width - 10))
  const flipsUp = menu.y + MENU_HEIGHT_ESTIMATE > window.innerHeight
  const y = flipsUp ? Math.max(10, menu.y - MENU_HEIGHT_ESTIMATE) : Math.max(10, menu.y)

  return (
    <div className="context-menu" role="menu" ref={ref} style={{ left: x, top: y }}>
      {items.map(item => (
        <button
          key={item.label}
          role="menuitem"
          className={item.danger ? 'danger' : ''}
          onClick={() => {
            closeMenu()
            item.run()
          }}
        >
          {ico(item.icon)}
          {item.label}
        </button>
      ))}
    </div>
  )
}

function buildItems(menu: ContextMenuState, snapshot: ReturnType<typeof useLibrary.getState>['snapshot']): Item[] {
  if (menu.kind === 'folder') {
    const folder = snapshot?.folders.find(f => f.name === menu.folder)
    const isVirtual = folder?.virtual ?? false
    const items: Item[] = [
      { label: 'New note', icon: 'plus', run: () => void createNoteOp(menu.folder) },
      { label: 'Import files…', icon: 'upload', run: () => void chooseImportOp(menu.folder) },
      {
        label: 'Change color…',
        icon: 'palette',
        run: () => useUI.getState().openModal({ type: 'recolor-folder', folder: menu.folder })
      },
      { label: 'Reveal in File Explorer', icon: 'folder', run: () => (isVirtual ? void api.openRoot().catch(() => undefined) : void revealOp(menu.folder)) }
    ]
    if (!isVirtual) {
      items.push(
        { label: 'Rename collection', icon: 'rename', run: () => useUI.getState().openModal({ type: 'rename-folder', folder: menu.folder }) },
        { label: 'Delete collection', icon: 'trash', danger: true, run: () => promptDeleteFolder(menu.folder, folder?.files.length ?? 0) }
      )
    }
    return items
  }
  const relPath = menu.relPath
  const meta = snapshot?.folders.flatMap(f => f.files).find(f => f.relPath === relPath)
  const name = meta?.name ?? relPath.split('/').pop() ?? relPath
  const kind = kindForExt(meta?.ext ?? '')
  const items: Item[] = [
    { label: 'Preview', icon: 'eye', run: () => useUI.getState().openPreview(relPath) },
    { label: 'Open with default app', icon: 'arrow', run: () => void openExternalOp(relPath) },
    { label: 'Edit', icon: 'note', run: () => void useUI.getState().openEditor(relPath) },
    { label: 'Rename', icon: 'rename', run: () => useUI.getState().openModal({ type: 'rename-file', relPath }) },
    { label: 'Move to collection…', icon: 'move', run: () => useUI.getState().openModal({ type: 'move-file', relPath }) },
    {
      label: useUI.getState().starred.includes(relPath) ? 'Unstar file' : 'Star file',
      icon: 'star',
      run: () => useUI.getState().toggleStar(relPath)
    },
    { label: 'Reveal in File Explorer', icon: 'folder', run: () => void revealOp(relPath) }
  ]
  if (isTextKind(kind) && !meta?.binary) {
    items.splice(6, 0, { label: 'Copy contents', icon: 'copy', run: () => void copyTextOp(relPath) })
  }
  items.push({ label: 'Delete file', icon: 'trash', danger: true, run: () => promptDeleteFile(relPath, name) })
  return items
}
