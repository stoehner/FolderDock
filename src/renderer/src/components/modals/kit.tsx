import { ico } from '../../lib/icons'
import { useUI } from '../../state/ui'

export function Head({ icon, title, sub, onClose }: { icon: string; title: string; sub: string; onClose: () => void }) {
  return (
    <div className="modal-head">
      <div className="modal-head-icon">{ico(icon)}</div>
      <div>
        <strong>{title}</strong>
        <p>{sub}</p>
      </div>
      <button className="exit" onClick={onClose} aria-label="Close dialog">
        {ico('x')}
      </button>
    </div>
  )
}

export function Foot({ children }: { children: React.ReactNode }) {
  return (
    <div className="modal-foot">
      <button className="secondary-button" onClick={() => useUI.getState().closeModal()}>
        Cancel
      </button>
      {children}
    </div>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      className={`settings-toggle${on ? ' on' : ''}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
    >
      <span className="settings-toggle-knob" />
    </button>
  )
}
