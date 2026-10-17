import { describe, expect, it } from 'vitest'
import { extractExcerpt, firstHeading, looksBinary } from './excerpt'
import { DEFAULT_PREFS, mergePrefs, prunePrefs } from './prefs'
import { kindForExt, extOf } from './kinds'

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

describe('looksBinary', () => {
  it('flags NUL-containing buffers', () => {
    expect(looksBinary(Buffer.from([0x00, 0x01, 0x02]))).toBe(true)
  })
  it('accepts plain text', () => {
    expect(looksBinary(Buffer.from('plain utf8 text'))).toBe(false)
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
