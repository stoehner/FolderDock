import { describe, expect, it } from 'vitest'
import { extractExcerpt, firstHeading, matchSnippet } from './excerpt'
import { DEFAULT_PREFS, mergePrefs, prunePrefs } from './prefs'
import { kindForExt, extOf } from './kinds'
import { compareFiles } from './sort'
import type { FileMeta } from './types'

function meta(name: string, size: number, mtimeMs: number): FileMeta {
  return { relPath: name, name, ext: '', kind: 'markdown', size, mtimeMs, binary: false }
}

describe('extractExcerpt', () => {
  it('strips markdown structure into a plain sentence flow', () => {
    const md = '# Title\n\n- one\n- two\n\nSome **bold** and `code`.'
    expect(extractExcerpt(md)).toBe('Title one two Some bold and code.')
  })
  it('collapses code fences', () => {
    expect(extractExcerpt('```\nconst x = 1\n```')).toBe('code example')
  })
  it('respects max length with ellipsis', () => {
    expect(extractExcerpt('a'.repeat(300), 10)).toBe('aaaaaaaaaa…')
  })
  it('returns empty for blank content', () => {
    expect(extractExcerpt('   ')).toBe('')
  })
  it('keeps link text', () => {
    expect(extractExcerpt('See [docs](https://example.com)')).toBe('See docs')
  })
})

describe('firstHeading', () => {
  it('finds the first heading', () => {
    expect(firstHeading('intro\n\n## Real Title\n')).toBe('Real Title')
  })
  it('returns null when absent', () => {
    expect(firstHeading('no headings')).toBeNull()
  })
})

describe('matchSnippet', () => {
  it('returns the match plus context with no ellipses when it fits', () => {
    expect(matchSnippet('the quick brown fox', 4, 5)).toBe('the quick brown fox')
  })
  it('adds leading and trailing ellipses when the match is deep in the text', () => {
    const long = 'x'.repeat(120) + ' needle ' + 'y'.repeat(120)
    const out = matchSnippet(long, 121, 6)
    expect(out.startsWith('…')).toBe(true)
    expect(out.endsWith('…')).toBe(true)
    expect(out).toContain('needle')
  })
  it('collapses whitespace inside the snippet', () => {
    expect(matchSnippet('a\n\nb   match\nc', 9, 5)).toBe('a b match c')
  })
  it('returns an empty string for a whitespace-only window', () => {
    expect(matchSnippet('   ', 1, 1)).toBe('')
  })
})

describe('compareFiles', () => {
  it('sorts by name case-insensitively via locale compare', () => {
    expect(compareFiles(meta('Bravo.md', 1, 1), meta('alpha.md', 1, 1), 'name')).toBeGreaterThan(0)
    expect(compareFiles(meta('alpha.md', 1, 1), meta('Bravo.md', 1, 1), 'name')).toBeLessThan(0)
  })
  it('sorts largest first by size', () => {
    expect(compareFiles(meta('big.md', 900, 1), meta('small.md', 10, 1), 'size')).toBeLessThan(0)
    expect(compareFiles(meta('small.md', 10, 1), meta('big.md', 900, 1), 'size')).toBeGreaterThan(0)
  })
  it('sorts newest first by recent', () => {
    expect(compareFiles(meta('old.md', 1, 100), meta('new.md', 1, 200), 'recent')).toBeGreaterThan(0)
    expect(compareFiles(meta('new.md', 1, 200), meta('old.md', 1, 100), 'recent')).toBeLessThan(0)
  })
})

describe('prefs', () => {
  it('merges garbage into defaults', () => {
    const p = mergePrefs({ theme: 'banana', folderArt: { a: 'nope', b: 'ember' }, starred: ['ok', 5] })
    expect(p.theme).toBe('dark')
    expect(p.folderArt).toEqual({ b: 'ember' })
    expect(p.starred).toEqual(['ok'])
  })
  it('prunes orphans after folders disappear', () => {
    const p = { ...DEFAULT_PREFS, folderOrder: ['a', 'b', 'gone'], folderArt: { a: 'slate', gone: 'dusk' }, openFolder: 'gone' }
    const pruned = prunePrefs(p, ['a', 'b'])
    expect(pruned.folderOrder).toEqual(['a', 'b'])
    expect(pruned.folderArt).toEqual({ a: 'slate' })
    expect(pruned.openFolder).toBeNull()
  })
})

describe('kinds', () => {
  it('classifies extensions', () => {
    expect(kindForExt(extOf('Notes.MD'))).toBe('markdown')
    expect(kindForExt('.webp')).toBe('image')
    expect(kindForExt('.pdf')).toBe('pdf')
    expect(kindForExt('.ts')).toBe('text')
    expect(kindForExt('.exe')).toBe('other')
  })
  it('ignores dotfiles as extensionless', () => {
    expect(extOf('.gitignore')).toBe('')
  })
})
