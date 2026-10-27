import { useEffect } from 'react'
import type { FileMeta } from '../../../shared/types'
import { extOf, kindForExt } from '../../../shared/kinds'
import { fdfileUrl } from '../lib/api'
import { finishOutDrag, startOutDrag } from '../lib/dragOut'
import { useExcerpts } from '../state/excerpts'
import { useLibrary } from '../state/library'
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
  const root = useLibrary(s => s.snapshot?.root ?? '')
  const openPreview = useUI(s => s.openPreview)
  const isImage = file.kind === 'image'
  useEffect(() => {
    if (!isImage) useExcerpts.getState().ensureExcerpt(file.relPath)
  }, [file.relPath, isImage])
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
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          openPreview(file.relPath)
        }
      }}
      onDragStart={e => startOutDrag(e, file.relPath, root)}
      onDragEnd={e => finishOutDrag(e, file.relPath, file.size)}
    >
      <div className="sheet-top">
        <span className="mini-badge">{typeTag(file)}</span>
        <span className="sheet-ext">{ext}</span>
      </div>
      <div className="sheet-title">{file.name}</div>
      {isImage && root ? (
        <div className="sheet-thumb">
          <img src={fdfileUrl(root, file.relPath)} alt="" draggable={false} loading="lazy" />
        </div>
      ) : (
        <div className="sheet-text">{summary || (file.binary ? 'Binary content' : 'Empty file — click to open')}</div>
      )}
      <span className="sheet-grab">↗ drag</span>
    </div>
  )
}