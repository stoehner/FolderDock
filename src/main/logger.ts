import fsSync from 'node:fs'
import path from 'node:path'

// The diagnostics ledger: a local-only, human-readable append log plus hang snapshots.
// Every write is fire-and-forget and guarded — logging itself must never be able to
// hang or crash the app it is observing. No network, no telemetry: the ledger lives
// beside the app's own data on this machine and nothing ever leaves it.

export type LogDetail = 'basic' | 'verbose'
export type LogLineLevel = 'info' | 'warn' | 'error'

const ROTATE_BYTES = 1024 * 1024
const ARCHIVE_NAME = 'main.1.log'
const SNAPSHOT_NAME = 'hang-snapshot.json'

let logDir = ''
let logFile = ''
let verbose = false
const queue: string[] = []

export function initLog(dir: string, opts: { verbose?: boolean } = {}): void {
  logDir = dir
  logFile = path.join(dir, 'main.log')
  verbose = opts.verbose === true
  try {
    fsSync.mkdirSync(dir, { recursive: true })
  } catch {
    // An unusable log dir must never block boot; lines simply drop.
  }
  logLine('info', 'log', `ledger opened in ${dir} (detail ${verbose ? 'verbose' : 'basic'})`)
}

export function setVerbose(on: boolean): void {
  verbose = on
}

export function isVerbose(): boolean {
  return verbose
}

export function logPaths(): { dir: string; file: string } {
  return { dir: logDir, file: logFile }
}

export function logLine(level: LogLineLevel, tag: string, message: string): void {
  if (!logFile) return
  const stamp = new Date().toISOString()
  queue.push(`${stamp} ${level.toUpperCase().padEnd(5)} ${tag}: ${flatten(message)}`)
  flushQueue()
}

export function logVerbose(tag: string, message: string): void {
  if (verbose) logLine('info', tag, message)
}

function flatten(message: string): string {
  return message.replace(/\s+/g, ' ').trim().slice(0, 2000)
}

function flushQueue(): void {
  while (queue.length > 0) {
    const lines = `${queue.splice(0, queue.length).join('\n')}\n`
    try {
      if (fsSync.existsSync(logFile) && fsSync.statSync(logFile).size > ROTATE_BYTES) rotate()
      fsSync.appendFileSync(logFile, lines)
    } catch {
      // Best effort only: a failed write must never propagate into app code.
    }
  }
}

/** Moves the grown log to main.1.log (previous archive replaced), then appending continues fresh. */
function rotate(): void {
  try {
    fsSync.rmSync(path.join(logDir, ARCHIVE_NAME), { force: true })
    fsSync.renameSync(logFile, path.join(logDir, ARCHIVE_NAME))
  } catch {
    // Rotation is an optimization; failed rotations just keep one larger file.
  }
}

/** The last n lines of the ledger, oldest last. Empty array when the log is absent. */
export function logTail(n: number): string[] {
  try {
    if (!logFile || !fsSync.existsSync(logFile)) return []
    const text = fsSync.readFileSync(logFile, 'utf8')
    const lines = text.trimEnd().length > 0 ? text.trimEnd().split('\n') : []
    return lines.slice(-n)
  } catch {
    return []
  }
}

/**
 * The frozen-state report: why, when, environment, and the last 35 ledger lines.
 * Written when the window stops responding (and keeps existing afterwards), so a
 * force-close by the user still leaves the frozen moment fully explainable on disk.
 */
export function writeHangSnapshot(reason: string, extra: Record<string, unknown> = {}): void {
  try {
    if (!logDir) return
    const payload = {
      when: new Date().toISOString(),
      reason,
      ...extra,
      tail: logTail(35)
    }
    fsSync.writeFileSync(path.join(logDir, SNAPSHOT_NAME), `${JSON.stringify(payload, null, 2)}\n`)
    logLine('warn', 'snapshot', `hang snapshot written (${reason})`)
  } catch {
    // Best effort: diagnosing a hang must never be able to worsen one.
  }
}
