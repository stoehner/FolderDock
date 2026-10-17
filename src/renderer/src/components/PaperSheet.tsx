import { useEffect } from 'react'
import type { FileMeta } from '../../../shared/types'
import { extOf, kindForExt } from '../../../shared/kinds'
import { api } from '../lib/api'
import { useExcerpts } from '../state/excerpts'
import { useUI } from '../state/ui'

function typeTag(file: FileMeta): string {
  const kind = kindForExt(file.ext)
  if (kind === 'markdown') return 'MD FILE'
  if (kind === 'image') return 'IMAGE FILE'
  if (kind === 'pdf') return 'PDF FILE'
  if (kind === 'text') return 'TEXT FILE'
  return 'FILE'
}

export function PaperSheet({
  file,
  folderName,
  slot,
  selected
}: {
  file: FileMeta
  folderName: string
  slot: string
  selected: boolean
}) {
  const excerpt = useExcerpts(s => s.texts[file.relPath])
  const openPreview = useUI(s => s.openPreview)
  const openEditor = useUI(s => s.openEditor)
  useEffect(() => {
    useExcerpts.getState().ensureExcerpt(file.relPath)
  }, [file.relPath])
  const ext = (extOf(file.name).replace('.', '') || 'FILE').slice(0, 7).toUpperCase()
  const summary = (excerpt ?? '').slice(0, 85)

  return (
    <div
      className={`sheet ${slot} document-sheet${selected ? ' selected-paper' : ''}`}
      role="button"
      tabIndex={0}
      draggable
      data-file={file.relPath}
      data-folder={folderName}
      aria-label={`${file.name}: drag this sheet out, or press Enter to preview`}
      title={`Drag ${file.name} out · click to preview`}
      onClick={() => openPreview(file.relPath)}
      onDoubleClick={e => {
        e.stopPropagation()
        void openEditor(file.relPath)
      }}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          openPreview(file.relPath)
        }
      }}
      onDragStart={e => {
        e.preventDefault()
        api.startDrag(file.relPath)
      }}
    >
      <div className="sheet-top">
        <span className="mini-badge">{typeTag(file)}</span>
        <span className="sheet-ext">{ext}</span>
      </div>
      <div className="sheet-title">{file.name}</div>
      <div className="sheet-text">{summary || (file.binary ? 'Binary content' : 'Empty file — click to open')}</div>
      <span className="sheet-grab">↗ drag</span>
    </div>
  )
}