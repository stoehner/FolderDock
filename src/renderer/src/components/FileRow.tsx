import type { FileMeta } from '../../../shared/types'
import { api, formatSize } from '../lib/api'
import { ico } from '../lib/icons'
import { useUI } from '../state/ui'
import { promptDeleteFile } from '../lib/ops'

function iconFor(file: FileMeta): string {
  if (file.kind === 'image') return 'image'
  if (file.kind === 'pdf') return 'pdf'
  return 'file'
}

function kindClass(file: FileMeta): string {
  if (file.kind === 'image') return 'image'
  if (file.kind === 'pdf') return 'pdf'
  if (file.kind === 'text' || file.kind === 'markdown') return 'text'
  return ''
}

export function FileRow({ file, selected }: { file: FileMeta; selected: boolean }) {
  const openPreview = useUI(s => s.openPreview)
  const openEditor = useUI(s => s.openEditor)
  const openMenu = useUI(s => s.openMenu)
  const isStarred = useUI(s => s.starred.includes(file.relPath))

  return (
    <div
      className={`file-row${selected ? ' is-selected' : ''}`}
      data-file={file.relPath}
      draggable
      tabIndex={0}
      role="button"
      aria-label={`Preview ${file.name}`}
      title="Drag out or into another collection · click to preview · double-click to edit"
      onClick={() => openPreview(file.relPath)}
      onDoubleClick={e => {
        e.stopPropagation()
        void openEditor(file.relPath)
      }}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openPreview(file.relPath)
        } else if (e.key === 'F2') {
          e.preventDefault()
          useUI.getState().openModal({ type: 'rename-file', relPath: file.relPath })
        } else if (e.key === 'Delete') {
          e.preventDefault()
          promptDeleteFile(file.relPath, file.name)
        }
      }}
      onDragStart={e => {
        e.preventDefault()
        api.startDrag(file.relPath)
      }}
    >
      <span className={`typeicon ${kindClass(file)}`}>{ico(iconFor(file))}</span>
      <div className="file-info">
        <div className="file-name">
          {file.name}
          {isStarred ? ' ★' : ''}
        </div>
        <div className="file-meta">
          {formatSize(file.size)} · {new Date(file.mtimeMs).toLocaleDateString()}
        </div>
      </div>
      <button
        className="file-more"
        onClick={e => {
          e.stopPropagation()
          const r = e.currentTarget.getBoundingClientRect()
          openMenu({ kind: 'file', relPath: file.relPath, x: r.right - 190, y: r.bottom + 4 })
        }}
        aria-label={`Options for ${file.name}`}
        title="File options"
      >
        {ico('more')}
      </button>
    </div>
  )
}
