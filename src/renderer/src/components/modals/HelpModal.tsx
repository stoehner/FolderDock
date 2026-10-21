import { useUI } from '../../state/ui'
import { Head } from './kit'

export function HelpModal() {
  return (
    <section className="modal" role="dialog" aria-modal="true" aria-label="How FolderDock works">
      <Head icon="info" title="How FolderDock works" sub="Everything here is a real file on disk." onClose={() => useUI.getState().closeModal()} />
      <div className="modal-content">
        <div className="markdown-preview" style={{ height: 'auto', maxHeight: 420 }}>
          <h2>Using your shelf</h2>
          <p>
            Click a glass folder front to open it in place and see its file list. Grab a visible paper sheet and drag it
            straight into Explorer or any app that accepts files — the original always stays in your library.
          </p>
          <p>
            Drop files from Explorer onto a collection, the drop zone under the toolbar, or the shelf background to
            move them into your library; the source copy is removed, so there is nothing to clean up afterwards. Drag
            a sheet onto another collection card to move it between collections.
          </p>
          <p>
            Click the star on a file row or a collection card to add it to Favorites, then use the Favorites filter to
            see them all at once. Hover any sheet or row for a quick summary, click to open the preview modal, and
            double-click (or press Edit) to open the text editor.
          </p>
          <h2>Shortcuts</h2>
          <p>
            <span className="kbd">Ctrl F</span> search · <span className="kbd">Ctrl N</span> new note ·{' '}
            <span className="kbd">Ctrl S</span> save in editor · <span className="kbd">F2</span> rename selected file ·{' '}
            <span className="kbd">Del</span> delete selected file · <span className="kbd">Esc</span> close topmost panel
          </p>
          <h2>Where your files live</h2>
          <p>
            Your library is a normal Windows folder (default: Documents\FolderDock). You can change it in Settings, and
            Back up now copies the whole library into a timestamped folder under your backup location. Deleting moves
            files to the Recycle Bin. FolderDock never uploads anything anywhere.
          </p>
        </div>
      </div>
      <div className="modal-foot">
        <button className="primary-button" onClick={() => useUI.getState().closeModal()}>
          Got it
        </button>
      </div>
    </section>
  )
}
