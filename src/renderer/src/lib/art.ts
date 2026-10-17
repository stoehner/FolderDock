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
  }
}

export const ART_CYCLE = ['aurora', 'ember', 'dusk', 'glacier', 'verdant', 'slate']

const FALLBACK_ART: ArtStyle = { tab: '#687b90', art: 'linear-gradient(115deg,#a1adb8 5%,#5b6e81 34%,#2e4256 60%,#82949d 97%)' }

export function artFor(name: string, override?: string): ArtStyle {
  const id = override ?? ART_CYCLE[hashName(name) % ART_CYCLE.length] ?? 'slate'
  return artStyles[id] ?? FALLBACK_ART
}
function hashName(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function makeArtVars(art: ArtStyle): React.CSSProperties {
  return { '--art': art.art, '--tab': art.tab } as React.CSSProperties
}
