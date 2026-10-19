import { ico } from '../../lib/icons'
import { folderOfRel } from '../../lib/api'
import { useLibrary } from '../../state/library'
import { useUI } from '../../state/ui'
import { moveFilesOp } from '../../lib/ops'
import { Head } from './kit'

export function MoveFilesModal({ relPaths }: { relPaths: string[] }) {
  const snapshot = useLibrary(s => s.snapshot)
  const folders = snapshot?.folders ?? []
  const currentFolders = new Set(relPaths.map(p => folderOfRel(p)))
  return (
    <section className="modal" role="dialog" aria-modal="true" aria-label="Move files">
      <Head
        icon="move"
        title="Move files"
        sub={`${relPaths.length} files move with real file system moves.`}
        onClose={() => useUI.getState().closeModal()}
      />
      <div className="modal-content">
        <div className="move-list">
          {folders.map(f => (
            <button
              key={f.name}
              className="move-option"
              disabled={currentFolders.size === 1 && currentFolders.has(f.name)}
              onClick={() => void moveFilesOp(relPaths, f.name)}
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
