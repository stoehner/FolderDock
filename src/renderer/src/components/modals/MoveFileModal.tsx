import { ico } from '../../lib/icons'
import { folderOfRel } from '../../lib/api'
import { useLibrary } from '../../state/library'
import { useUI } from '../../state/ui'
import { moveFilesOp } from '../../lib/ops'
import { Head } from './kit'

export function MoveFileModal({ relPath }: { relPath: string }) {
  const snapshot = useLibrary(s => s.snapshot)
  const current = folderOfRel(relPath)
  const folders = snapshot?.folders ?? []
  return (
    <section className="modal" role="dialog" aria-modal="true" aria-label="Move file">
      <Head
        icon="move"
        title="Move file"
        sub={relPath.split('/').pop() ?? relPath}
        onClose={() => useUI.getState().closeModal()}
      />
      <div className="modal-content">
        <div className="move-list">
          {folders.map(f => (
            <button
              key={f.name}
              className="move-option"
              disabled={f.name === current}
              onClick={() => void moveFilesOp([relPath], f.name)}
            >
              {ico('folder', 'tiny')}
              {f.name}
            </button>
          ))}
        </div>
        <p className="helper">Files move between collections with a real file system move.</p>
      </div>
    </section>
  )
}
