import { artStyles, artIdFor, ART_CYCLE } from '../../lib/art'
import { useUI } from '../../state/ui'
import { Head, Foot } from './kit'

export function RecolorFolderModal({ folder }: { folder: string }) {
  const folderArt = useUI(s => s.folderArt)
  const setFolderArt = useUI(s => s.setFolderArt)
  const currentId = folderArt[folder] ?? artIdFor(folder)
  return (
    <section className="modal" role="dialog" aria-modal="true" aria-label="Change folder color">
      <Head
        icon="palette"
        title="Change folder color"
        sub={`Live preview — pick a style for “${folder}”.`}
        onClose={() => useUI.getState().closeModal()}
      />
      <div className="modal-content">
        <div className="colors" style={{ marginTop: 0 }}>
          {ART_CYCLE.map(id => (
            <button
              key={id}
              className={`swatch${currentId === id ? ' selected' : ''}`}
              style={{ background: artStyles[id]?.art }}
              onClick={() => setFolderArt(folder, id)}
              title={id}
              aria-label={`Art style ${id}`}
            />
          ))}
        </div>
        <p className="helper">Colors are saved instantly and only affect how FolderDock displays the collection.</p>
      </div>
      <Foot>
        <button className="primary-button" onClick={() => useUI.getState().closeModal()}>
          Done
        </button>
      </Foot>
    </section>
  )
}
