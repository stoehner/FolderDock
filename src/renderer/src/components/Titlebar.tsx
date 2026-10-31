import { api } from '../lib/api'
import { ico } from '../lib/icons'
import { useUI } from '../state/ui'

export function Titlebar() {
  const maximized = useUI(s => s.maximized)
  return (
    <div className="titlebar" onDoubleClick={() => api.toggleMaximize()}>
      <div className="brand-mark">{ico('stack')}</div>
      <span className="brand">FolderDock</span>
      <span className="submark">/ personal library</span>
      <div className="window-actions">
        <button className="win-btn" onClick={() => api.minimize()} aria-label="Minimize window">
          {ico('minus')}
        </button>
        <button
          className="win-btn"
          onClick={() => api.toggleMaximize()}
          aria-label={maximized ? 'Restore window' : 'Maximize window'}
        >
          {ico(maximized ? 'restore' : 'maximize')}
        </button>
        <button className="win-btn close" onClick={() => api.close()} aria-label="Close window">
          {ico('x')}
        </button>
      </div>
    </div>
  )
}
