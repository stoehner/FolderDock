import { isHexColor } from '../../../shared/art-values'

export interface ArtStyle {
  tab: string
  art: string
}

export const artStyles: Record<string, ArtStyle> = {
  aurora: {
    tab: '#9c7d81',
    art: 'linear-gradient(115deg,#b7bbce 1%,#dfb3a7 26%,#9b5056 48%,#34364f 65%,#688ba2 92%)'
  },
  ember: {
    tab: '#8d5147',
    art: 'radial-gradient(ellipse at 81% 70%,#ce6444 0%,transparent 44%),radial-gradient(ellipse at 15% 26%,#527d83,transparent 57%),linear-gradient(115deg,#27363e,#1b2229 70%)'
  },
  dusk: {
    tab: '#7d6480',
    art: 'radial-gradient(ellipse at 20% 75%,#b97867,transparent 58%),linear-gradient(130deg,#695579,#353449 59%,#b07b77)'
  },
  glacier: {
    tab: '#77919f',
    art: 'linear-gradient(135deg,#dce8e9 1%,#9eb7c7 26%,#667c91 50%,#d9e3e6 76%,#708f9f)'
  },
  verdant: {
    tab: '#617b68',
    art: 'radial-gradient(ellipse at 83% 11%,#c5a77b,transparent 50%),linear-gradient(120deg,#1c4640,#426f58 40%,#243633 75%)'
  },
  slate: {
    tab: '#687b90',
    art: 'linear-gradient(115deg,#a1adb8 5%,#5b6e81 34%,#2e4256 60%,#82949d 97%)'
  },
  rose: {
    tab: '#a04a63',
    art: 'radial-gradient(ellipse at 20% 78%,#e3899f,transparent 55%),linear-gradient(115deg,#efb7c6 3%,#d25f83 37%,#7e2c47 67%,#c05b7e 96%)'
  },
  amber: {
    tab: '#9d6a2e',
    art: 'radial-gradient(ellipse at 82% 18%,#f0cd8d,transparent 50%),linear-gradient(115deg,#eed8a4 3%,#d69a3f 37%,#7e511b 67%,#c68a35 96%)'
  },
  coral: {
    tab: '#a04836',
    art: 'radial-gradient(ellipse at 18% 22%,#f5a284,transparent 52%),linear-gradient(115deg,#f7c2a9 3%,#e17a56 37%,#8a3320 67%,#cf664a 96%)'
  },
  ocean: {
    tab: '#3d6e9e',
    art: 'radial-gradient(ellipse at 80% 20%,#7fc6f2,transparent 50%),linear-gradient(115deg,#b9e0f3 3%,#3d8ec9 37%,#1b4a77 67%,#3f8cc2 96%)'
  },
  violet: {
    tab: '#785294',
    art: 'radial-gradient(ellipse at 22% 20%,#c9a1ec,transparent 52%),linear-gradient(115deg,#d9c0f0 3%,#9860cd 37%,#4b2c6e 67%,#8555bb 96%)'
  },
  meadow: {
    tab: '#4b7936',
    art: 'radial-gradient(ellipse at 80% 16%,#a8d876,transparent 50%),linear-gradient(115deg,#cde9a6 3%,#6cab3d 37%,#2f5a1d 67%,#5d9c35 96%)'
  },
  cherry: {
    tab: '#77293a',
    art: 'radial-gradient(ellipse at 20% 76%,#ae4f5c,transparent 58%),linear-gradient(120deg,#471b24,#77293a 44%,#29101a 78%)'
  },
  midnight: {
    tab: '#3a4a7c',
    art: 'radial-gradient(ellipse at 78% 22%,#4668b0,transparent 55%),linear-gradient(120deg,#131a30,#24355c 45%,#0a0f1d 78%)'
  },
  plum: {
    tab: '#5c386c',
    art: 'radial-gradient(ellipse at 22% 24%,#845899,transparent 55%),linear-gradient(120deg,#271930,#4a2d5b 44%,#1a1122 78%)'
  },
  forest: {
    tab: '#2e5c44',
    art: 'radial-gradient(ellipse at 78% 18%,#3d7a5b,transparent 55%),linear-gradient(120deg,#10231b,#224e3a 44%,#0a1611 78%)'
  },
  copper: {
    tab: '#7a4828',
    art: 'radial-gradient(ellipse at 20% 22%,#ac7747,transparent 55%),linear-gradient(120deg,#2f1e0e,#693c20 44%,#1f1206 78%)'
  },
  tide: {
    tab: '#29666d',
    art: 'radial-gradient(ellipse at 78% 20%,#3d95a0,transparent 55%),linear-gradient(120deg,#0e282c,#1f6169 44%,#091b1e 78%)'
  }
}

export const ART_SECTIONS: { label: string; ids: string[] }[] = [
  { label: 'Classics', ids: ['aurora', 'ember', 'dusk', 'glacier', 'verdant', 'slate'] },
  { label: 'Vivid', ids: ['rose', 'amber', 'coral', 'ocean', 'violet', 'meadow'] },
  { label: 'Deep', ids: ['cherry', 'midnight', 'plum', 'forest', 'copper', 'tide'] }
]

export const ART_CYCLE: string[] = ART_SECTIONS.flatMap(section => section.ids)

const FALLBACK_ART: ArtStyle = { tab: '#687b90', art: 'linear-gradient(115deg,#a1adb8 5%,#5b6e81 34%,#2e4256 60%,#82949d 97%)' }

export function artIdFor(name: string, override?: string, defaultId?: string): string {
  return override ?? defaultId ?? ART_CYCLE[hashName(name) % ART_CYCLE.length] ?? 'slate'
}

export function artFor(name: string, override?: string, defaultId?: string): ArtStyle {
  const value = override ?? defaultId
  if (value !== undefined && isHexColor(value)) return customArtFor(value)
  return artStyles[artIdFor(name, override, defaultId)] ?? FALLBACK_ART
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
}

function shadeHex(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex)
  const channel = (c: number): number => Math.max(0, Math.min(255, Math.round(c * factor)))
  return `#${[channel(r), channel(g), channel(b)].map(v => v.toString(16).padStart(2, '0')).join('')}`
}

export function customArtFor(hex: string): ArtStyle {
  const base = hex.toLowerCase()
  const hi = shadeHex(base, 1.35)
  const lo = shadeHex(base, 0.45)
  const echo = shadeHex(base, 0.72)
  return {
    tab: shadeHex(base, 0.55),
    art: `radial-gradient(ellipse at 20% 76%,${hi},transparent 58%),linear-gradient(115deg,${hi} 3%,${base} 37%,${lo} 68%,${echo} 96%)`
  }
}

function hashName(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function makeArtVars(art: ArtStyle): React.CSSProperties {
  return { '--art': art.art, '--tab': art.tab } as React.CSSProperties
}
