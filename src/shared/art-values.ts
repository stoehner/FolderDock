export const ART_IDS = [
  'aurora',
  'ember',
  'dusk',
  'glacier',
  'verdant',
  'slate',
  'rose',
  'amber',
  'coral',
  'ocean',
  'violet',
  'meadow',
  'cherry',
  'midnight',
  'plum',
  'forest',
  'copper',
  'tide'
] as const

export const VARIED = 'varied'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value)
}

export function isArtValue(value: string): boolean {
  return (ART_IDS as readonly string[]).includes(value) || isHexColor(value)
}

export function isNewFolderArtValue(value: string): boolean {
  return value === VARIED || isArtValue(value)
}
