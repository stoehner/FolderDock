import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { DEFAULT_PREFS, mergePrefs } from '../shared/prefs'
import type { Prefs } from '../shared/types'

export class PrefsStore {
  private file: string
  private data: Prefs = DEFAULT_PREFS
  private timer: NodeJS.Timeout | null = null

  constructor(dir: string) {
    this.file = path.join(dir, 'ui-prefs.json')
    try {
      fs.mkdirSync(dir, { recursive: true })
    } catch {
      /* userData always exists */
    }
  }

  load(): Prefs {
    try {
      const raw = fs.readFileSync(this.file, 'utf8')
      this.data = mergePrefs(JSON.parse(raw))
    } catch {
      this.data = { ...DEFAULT_PREFS }
    }
    return this.data
  }

  get(): Prefs {
    return this.data
  }

  patch(partial: Partial<Prefs>): Prefs {
    this.data = { ...this.data, ...partial }
    this.scheduleSave()
    return this.data
  }

  scheduleSave(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.save(), 150)
  }

  async save(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    try {
      const tmp = `${this.file}.fdtmp`
      await fsp.writeFile(tmp, JSON.stringify(this.data, null, 2), 'utf8')
      await fsp.rename(tmp, this.file)
    } catch (err) {
      console.warn('[folderdock] prefs save failed:', err)
    }
  }
}
