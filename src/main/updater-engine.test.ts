import { describe, expect, it } from 'vitest'
import type { UpdateStateView } from '../shared/types'
import { createInitialUpdateState, reduceUpdateEvent } from './updater-engine'

const baseView = (): UpdateStateView => ({
  status: 'idle',
  version: '1.3.3',
  note: 'Checked at launch. The update downloads on its own and installs when FolderDock quits.',
  progress: null,
  canInstall: false,
  portable: false
})

describe('createInitialUpdateState', () => {
  it('disables in a development build', () => {
    const s = createInitialUpdateState({ version: '1.3.3', portable: false, disabled: true })
    expect(s.status).toBe('disabled')
    expect(s.canInstall).toBe(false)
  })

  it('marks portable copies as announce-only', () => {
    const s = createInitialUpdateState({ version: '1.3.4', portable: true, disabled: false })
    expect(s.status).toBe('idle')
    expect(s.portable).toBe(true)
    expect(s.version).toBe('1.3.4')
  })
})

describe('reduceUpdateEvent', () => {
  it('starts a download for installed copies', () => {
    const s = reduceUpdateEvent(baseView(), { type: 'available', version: '1.3.4' }, '1.3.3')
    expect(s.status).toBe('downloading')
    expect(s.version).toBe('1.3.4')
    expect(s.progress).toBe(0)
    expect(s.canInstall).toBe(false)
  })

  it('stays announce-only for portable copies', () => {
    const prev = { ...baseView(), portable: true }
    const s = reduceUpdateEvent(prev, { type: 'available', version: '1.3.4' }, '1.3.3')
    expect(s.status).toBe('available')
    expect(s.canInstall).toBe(false)
    expect(s.note).toContain('1.3.4')
  })

  it('tracks download progress as a percent', () => {
    let s = reduceUpdateEvent({ ...baseView(), status: 'downloading', version: '1.3.4', progress: 0 }, { type: 'progress', percent: 42.4 }, '1.3.3')
    expect(s.progress).toBe(42)
    s = reduceUpdateEvent(s, { type: 'progress', percent: 130 }, '1.3.3')
    expect(s.progress).toBe(100)
    expect(s.note).toContain('100%')
  })

  it('marks an installed app able to install once downloaded', () => {
    const s = reduceUpdateEvent({ ...baseView(), status: 'downloading', version: '1.3.4' }, { type: 'downloaded', version: '1.3.4' }, '1.3.3')
    expect(s.status).toBe('downloaded')
    expect(s.progress).toBe(100)
    expect(s.canInstall).toBe(true)
  })

  it('never allows a portable copy to self-install', () => {
    const prev = { ...baseView(), portable: true, status: 'downloading' as const, version: '1.3.4', progress: 90 }
    const s = reduceUpdateEvent(prev, { type: 'downloaded', version: '1.3.4' }, '1.3.3')
    expect(s.status).toBe('downloaded')
    expect(s.canInstall).toBe(false)
  })

  it('reports up to date with the running version', () => {
    const s = reduceUpdateEvent(baseView(), { type: 'notAvailable' }, '1.3.4')
    expect(s.status).toBe('uptodate')
    expect(s.version).toBe('1.3.4')
    expect(s.note).toBe('Up to date.')
  })

  it('surfaces errors with the reason in the note', () => {
    const s = reduceUpdateEvent(baseView(), { type: 'error', message: 'ENOTFOUND releases' }, '1.3.3')
    expect(s.status).toBe('error')
    expect(s.note).toContain('ENOTFOUND')
    expect(s.canInstall).toBe(false)
  })
})
