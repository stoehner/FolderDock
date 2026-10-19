import { useUI } from '../state/ui'
import { promptDeleteFiles } from '../lib/ops'

export function SelectionBar() {
  const selection = useUI(s => s.selection)
  if (selection.length === 0) return null
  return (
    <div className="selection-bar" role="toolbar" aria-label="Selection actions">
      <strong>
        {selection.length} selected
      </strong>
      <button className="secondary-button" onClick={() => useUI.getState().openModal({ type: 'move-files', relPaths: [...selection] })}>
        Move to collection…
      </button>
      <button className="secondary-button" onClick={() => promptDeleteFiles([...selection])}>
        Delete
      </button>
      <button className="secondary-button" onClick={() => useUI.getState().clearSelection()}>
        Clear
      </button>
    </div>
  )
}
