import { api } from './api'

// Renderer-side diagnostics tap. Everything goes to the main-process ledger through
// one validated IPC channel; failures inside this module must never surface in the
// app itself (a broken tap is a smaller problem than an app that dies logging).

export type DiagLevel = 'info' | 'warn' | 'error'

export function diagLog(level: DiagLevel, tag: string, message: string): void {
  try {
    api.logReport(level, tag, message)
  } catch {
    // No bridge (tests, early teardown): diagnostics drop silently.
  }
}

export function installDiagnostics(): void {
  window.addEventListener('error', ev => {
    const err = ev.error instanceof Error ? ev.error : null
    diagLog('error', 'window-error', err ? `${err.message} ${err.stack ?? ''}` : String(ev.message ?? 'unknown error'))
  })
  window.addEventListener('unhandledrejection', ev => {
    const r = ev.reason
    diagLog('error', 'unhandled-rejection', r instanceof Error ? `${r.message} ${r.stack ?? ''}` : String(r))
  })
  const started = Date.now()
  window.setInterval(() => {
    diagLog('info', 'heartbeat', `renderer alive ${Math.round((Date.now() - started) / 1000)}s`)
  }, 60_000)
}
