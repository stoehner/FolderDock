import type {
  ContentMatch,
  DetailedFileMeta,
  ImportResult,
  LibrarySnapshot,
  Prefs,
  TextFileContent,
  WriteTextRequest,
  WriteTextResult,
  IPCResult
} from './types'

export interface FolderDockBridge {
  appInfo(): Promise<IPCResult<{ version: string; electron: string; root: string; overridden: boolean; defaultRoot: string | null }>>
  scan(): Promise<IPCResult<LibrarySnapshot>>
  searchContent(query: string): Promise<IPCResult<ContentMatch[]>>
  createFolder(name: string): Promise<IPCResult<LibrarySnapshot>>
  renameFolder(oldName: string, newName: string): Promise<IPCResult<LibrarySnapshot>>
  deleteFolder(name: string): Promise<IPCResult<LibrarySnapshot>>
  createNote(folderName: string, baseName?: string): Promise<IPCResult<{ relPath: string; mtimeMs: number }>>
  readTextFile(relPath: string): Promise<IPCResult<TextFileContent>>
  writeTextFile(req: WriteTextRequest): Promise<IPCResult<WriteTextResult>>
  readBytes(relPath: string, maxBytes: number): Promise<IPCResult<ArrayBuffer>>
  excerpt(relPath: string): Promise<IPCResult<string>>
  fileMeta(relPath: string): Promise<IPCResult<DetailedFileMeta>>
  renameFile(relPath: string, newName: string): Promise<IPCResult<LibrarySnapshot>>
  moveFile(relPath: string, targetFolder: string): Promise<IPCResult<LibrarySnapshot>>
  deleteFile(relPath: string): Promise<IPCResult<LibrarySnapshot>>
  dropFiles(paths: string[], targetFolder: string): Promise<IPCResult<ImportResult>>
  chooseAndImport(targetFolder: string): Promise<IPCResult<ImportResult>>
  revealFile(relPath: string): Promise<IPCResult<void>>
  openFileExternal(relPath: string): Promise<IPCResult<void>>
  openRoot(): Promise<IPCResult<void>>
  chooseRoot(): Promise<IPCResult<string | null>>
  getPrefs(): Promise<IPCResult<Prefs>>
  setPrefs(patch: Partial<Prefs>): Promise<IPCResult<Prefs>>
  startDrag(relPath: string, additionalFiles?: string[]): void
  minimize(): void
  toggleMaximize(): void
  close(): void
  widen(width: number): void
  narrow(width: number): void
  getPathForFile(file: File): string
  onLibraryChanged(cb: () => void): () => void
  onWindowMaximized(cb: (maximized: boolean) => void): () => void
}

declare global {
  interface Window {
    folderdock: FolderDockBridge
  }
}
