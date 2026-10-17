import { describe, expect, it } from 'vitest'
import path from 'node:path'
import {
  checkFileName,
  checkFolderName,
  resolveWithinRoot,
  toRelPath,
  uniqueName
} from './validate'

describe('checkFolderName', () => {
  it('accepts ordinary names', () => {
    expect(checkFolderName('Research')).toEqual({ valid: true, value: 'Research' })
  })
  it('rejects path traversal and illegal characters', () => {
    expect(checkFolderName('../etc').valid).toBe(false)
    expect(checkFolderName('a/b').valid).toBe(false)
    expect(checkFolderName('a<b').valid).toBe(false)
  })
  it('rejects reserved windows names and Unsorted', () => {
    expect(checkFolderName('CON').valid).toBe(false)
    expect(checkFolderName('com1').valid).toBe(false)
    expect(checkFolderName('Unsorted').valid).toBe(false)
  })
  it('rejects duplicates case-insensitively', () => {
    expect(checkFolderName('notes', ['Notes']).valid).toBe(false)
  })
  it('rejects trailing dots and empty names', () => {
    expect(checkFolderName('name.').valid).toBe(false)
    expect(checkFolderName('   ').valid).toBe(false)
  })
})

describe('checkFileName', () => {
  it('accepts normal files', () => {
    expect(checkFileName('Boom Sauce UI.md').valid).toBe(true)
  })
  it('rejects illegal characters and reserved stems', () => {
    expect(checkFileName('a?b.md').valid).toBe(false)
    expect(checkFileName('NUL.txt').valid).toBe(false)
  })
})

describe('resolveWithinRoot', () => {
  const root = path.resolve('C:\\lib')
  it('resolves simple relative paths', () => {
    expect(resolveWithinRoot(root, 'Notes/a.md')).toBe(path.resolve(root, 'Notes/a.md'))
  })
  it('rejects escapes, absolutes and empties', () => {
    expect(resolveWithinRoot(root, '..\\secret.txt')).toBeNull()
    expect(resolveWithinRoot(root, 'C:\\Windows\\system32')).toBeNull()
    expect(resolveWithinRoot(root, '')).toBeNull()
    expect(resolveWithinRoot(root, '.')).toBeNull()
  })
  it('normalizes sneaky inner traversal that stays inside', () => {
    expect(resolveWithinRoot(root, 'Notes/../Notes/a.md')).toBe(path.resolve(root, 'Notes/a.md'))
  })
})

describe('toRelPath', () => {
  it('uses forward slashes', () => {
    expect(toRelPath('C:\\lib', 'C:\\lib\\Notes\\a.md')).toBe('Notes/a.md')
  })
})

describe('uniqueName', () => {
  it('returns the original when free', () => {
    expect(uniqueName(new Set(), 'a.md')).toBe('a.md')
  })
  it('appends an incrementing suffix on collision', () => {
    const existing = new Set(['a.md', 'A.MD', 'a (2).md'])
    expect(uniqueName(existing, 'a.md')).toBe('a (3).md')
  })
  it('handles extensionless files', () => {
    const existing = new Set(['LICENSE'])
    expect(uniqueName(existing, 'LICENSE')).toBe('LICENSE (2)')
  })
})
