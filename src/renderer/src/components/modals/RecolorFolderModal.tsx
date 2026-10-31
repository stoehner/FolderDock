import { ART_SECTIONS, artFor, artStyles } from '../../lib/art'
import { isHexColor } from '../../../../shared/art-values'
import { usePrefs } from '../../state/prefs'
import { useUI } from '../../state/ui'
import { Head, Foot } from './kit'
import { ColorPickerSwatch } from '../ColorPickerSwatch'

export function RecolorFolderModal({ folder }: { folder: string }) {
  const folderArt = useUI(s => s.folderArt)
  const setFolderArt = useUI(s => s.setFolderArt)
  const unsetFolderArt = useUI(s => s.unsetFolderArt)
  const newFolderArt = usePrefs(s => s.prefs.newFolderArt)
  const defaultId = newFolderArt !== 'varied' ? newFolderArt : undefined
  const current = folderArt[folder]
  const autoArt = artFor(folder, undefined, defaultId)
  const customActive = current !== undefined && isHexColor(current)
  return (
    <section className="modal" role="dialog" aria-modal="true" aria-label="Change folder color">
      <Head
        icon="palette"
        title="Change folder color"
        sub={`Live preview — pick a style for “${folder}”.`}
        onClose={() => useUI.getState().closeModal()}
      />
      <div className="modal-content">
        <div className="field-label" style={{ marginTop: 0 }}>
          Auto & custom
        </div>
        <div className="colors" style={{ marginTop: 0 }}>
          <button
            className={`swatch auto${current === undefined ? ' selected' : ''}`}
            style={{ background: autoArt.art }}
            onClick={() => unsetFolderArt(folder)}
            aria-label="Auto color"
          />
          <ColorPickerSwatch value={customActive ? current : undefined} onPick={hex => setFolderArt(folder, hex)} />
        </div>
        {ART_SECTIONS.map(section => (
          <div key={section.label} className="colors-section">
            <div className="field-label">{section.label}</div>
            <div className="colors">
              {section.ids.map(id => (
                <button
                  key={id}
                  className={`swatch${current === id ? ' selected' : ''}`}
                  style={{ background: artStyles[id]?.art }}
                  onClick={() => setFolderArt(folder, id)}
                  aria-label={`Art style ${id}`}
                />
              ))}
            </div>
          </div>
        ))}
        <p className="helper">
          Auto follows the name-based color; the rainbow swatch opens a color picker. Colors you apply are saved as
          swatches you can reuse or delete, and they only affect how FolderDock displays the collection.
        </p>
      </div>
      <Foot>
        <button className="primary-button" onClick={() => useUI.getState().closeModal()}>
          Done
        </button>
      </Foot>
    </section>
  )
}
