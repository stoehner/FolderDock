import { beforeEach, describe, expect, it } from 'vitest'
import fsSync from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { initLog, logLine, logPaths, logTail, logVerbose, setVerbose, writeHangSnapshot } from './logger'

// Node env: the ledger is pure node (no electron import) so it can be exercised headless.
// Each test starts from a fresh throwaway directory.

let dir = ''

beforeEach(() => {
  dir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'fd-log-'))
  initLog(dir)
})

describe('the diagnostics ledger', () => {
  it('writes timestamped flat lines with level and tag', () => {
    logLine('info', 'boot', 'hello world')
    const lines = logTail(1)
    expect(lines).toHaveLength(1)
    const line = lines[0] ?? ''
    expect(line).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z /)
    expect(lines[0]).toContain('INFO ')
    expect(lines[0]).toContain('boot: hello world')
  })

  it('flattens multi-line messages into one physical line', () => {
    logLine('error', 'flatten', 'first\nsecond\t\tthird\n')
    const [line] = logTail(1)
    const flat = line ?? ''
    expect(flat).toContain('first second third')
    expect(flat.includes('\n')).toBe(false)
  })

  it('rotates the grown log into main.1.log and keeps appending', () => {
    const file = path.join(dir, 'main.log')
    fsSync.writeFileSync(file, 'x'.repeat(1100 * 1024))
    logLine('info', 'rotate', 'after rotation')
    expect(fsSync.existsSync(path.join(dir, 'main.1.log'))).toBe(true)
    expect(fsSync.readFileSync(path.join(dir, 'main.1.log'), 'utf8')).toContain('xxxx')
    const last = logTail(1)
    expect(last[0]).toContain('rotate: after rotation')
  })

  it('tail(n) returns the last n lines in order', () => {
    logLine('info', 'a', 'one')
    logLine('info', 'b', 'two')
    logLine('info', 'c', 'three')
    const tail = logTail(2)
    expect(tail).toHaveLength(2)
    expect(tail[0]).toContain('b: two')
    expect(tail[1]).toContain('c: three')
  })

  it('verbose lines are written only when the detail level allows them', () => {
    setVerbose(false)
    logVerbose('quiet', 'must not appear')
    expect(logTail(10).some(l => l.includes('must not appear'))).toBe(false)
    setVerbose(true)
    logVerbose('quiet', 'now it appears')
    expect(logTail(1)[0]).toContain('now it appears')
  })

  it('writes a hang snapshot holding the reason and the recent tail', () => {
    logLine('info', 'boot', 'right before the hang')
    writeHangSnapshot('test-hang')
    const snap = JSON.parse(fsSync.readFileSync(path.join(dir, 'hang-snapshot.json'), 'utf8')) as {
      reason: string
      tail: string[]
    }
    expect(snap.reason).toBe('test-hang')
    expect(snap.tail.some(l => l.includes('right before the hang'))).toBe(true)
  })

  it('never throws when the ledger directory is unusable', () => {
    const blocked = path.join(os.tmpdir(), `fd-log-blocked-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    fsSync.writeFileSync(blocked, 'a file where the directory should be')
    expect(() => initLog(blocked)).not.toThrow()
    expect(() => logLine('info', 'blocked', 'still fine')).not.toThrow()
    fsSync.rmSync(blocked, { force: true })
  })

  it('names the ledger file for the diagnostics view', () => {
    expect(logPaths().file).toBe(path.join(dir, 'main.log'))
    expect(logPaths().dir).toBe(dir)
  })
})
