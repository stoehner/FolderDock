import { describe, expect, it } from 'vitest'
import { ART_CYCLE, ART_SECTIONS, artFor, artIdFor, artStyles, customArtFor } from './art'
import { ART_IDS, isArtValue, isHexColor, isNewFolderArtValue } from '../../../shared/art-values'

describe('art palette', () => {
  it('covers every declared art id with a defined style', () => {
    for (const id of ART_IDS) expect(artStyles[id], `style missing for ${id}`).toBeDefined()
    expect(ART_CYCLE).toHaveLength(ART_IDS.length)
    for (const section of ART_SECTIONS) {
      for (const id of section.ids) expect(ART_IDS).toContain(id)
    }
  })

  it('synthesizes a deterministic glass gradient from a custom hex', () => {
    const a = customArtFor('#ff8800')
    const b = customArtFor('#ff8800')
    expect(a).toEqual(b)
    expect(a.art).toContain('#ff8800')
    expect(a.tab).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('resolves custom hexes and the default-color fallback', () => {
    expect(artFor('X', '#ff8800').art).toContain('#ff8800')
    expect(artFor('X', undefined, 'ocean')).toBe(artStyles.ocean)
    expect(artIdFor('X', undefined, 'ocean')).toBe('ocean')
    expect(artIdFor('X', 'ember', 'ocean')).toBe('ember')
  })

  it('validates persisted art values', () => {
    expect(isHexColor('#ff8800')).toBe(true)
    expect(isHexColor('#fff')).toBe(false)
    expect(isHexColor('#12g45z')).toBe(false)
    expect(isArtValue('ocean')).toBe(true)
    expect(isArtValue('banana')).toBe(false)
    expect(isNewFolderArtValue('varied')).toBe(true)
    expect(isNewFolderArtValue('ocean')).toBe(true)
    expect(isNewFolderArtValue('#ff8800')).toBe(true)
    expect(isNewFolderArtValue('nope')).toBe(false)
  })
})
