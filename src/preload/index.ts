import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { FolderDockBridge } from '../shared/api'
import type {
  DetailedFileMeta,
  ImportResult,
  LibrarySnapshot,
  Prefs,
  TextFileContent,
  WriteTextRequest,
  WriteTextResult,
  IPCResult
} from '../shared/types'

type NoteResult = { relPath: string; mtimeMs: number }
type AppInfo = { version: string; electron: string; root: string; overridden: boolean; defaultRoot: string | null }

const api: FolderDockBridge = {
  appInfo: () => ipcRenderer.invoke('app:info') as Promise<IPCResult<AppInfo>>,
  scan: () => ipcRenderer.invoke('library:scan') as Promise<IPCResult<LibrarySnapshot>>,
  createFolder: (name: string) => ipcRenderer.invoke('folder:create', name) as Promise<IPCResult<LibrarySnapshot>>,
  renameFolder: (oldName: string, newName: string) =>
    ipcRenderer.invoke('folder:rename', oldName, newName) as Promise<IPCResult<LibrarySnapshot>>,
  deleteFolder: (name: string) => ipcRenderer.invoke('folder:delete', name) as Promise<IPCResult<LibrarySnapshot>>,
  readTextFile: (relPath: string) => ipcRenderer.invoke('file:readText', relPath) as Promise<IPCResult<TextFileContent>>,
  writeTextFile: (req: WriteTextRequest) => ipcRenderer.invoke('file:writeText', req) as Promise<IPCResult<WriteTextResult>>,
  readBytes: (relPath: string, maxBytes: number) =>
    ipcRenderer.invoke('file:readBytes', relPath, maxBytes) as Promise<IPCResult<ArrayBuffer>>,
  excerpt: (relPath: string) => ipcRenderer.invoke('file:excerpt', relPath) as Promise<IPCResult<string>>,
  fileMeta: (relPath: string) => ipcRenderer.invoke('file:meta', relPath) as Promise<IPCResult<DetailedFileMeta>>,
  renameFile: (relPath: string, newName: string) =>
    ipcRenderer.invoke('file:rename', relPath, newName) as Promise<IPCResult<LibrarySnapshot>>,
  moveFile: (relPath: string, targetFolder: string) =>
    ipcRenderer.invoke('file:move', relPath, targetFolder) as Promise<IPCResult<LibrarySnapshot>>,
  deleteFile: (relPath: string) => ipcRenderer.invoke('file:delete', relPath) as Promise<IPCResult<LibrarySnapshot>>,
  dropFiles: (paths: string[], targetFolder: string) =>
    ipcRenderer.invoke('files:drop', paths, targetFolder) as Promise<IPCResult<ImportResult>>,
  chooseAndImport: (targetFolder: string) =>
    ipcRenderer.invoke('files:choose', targetFolder) as Promise<IPCResult<ImportResult>>,
  revealFile: (relPath: string) => ipcRenderer.invoke('file:reveal', relPath) as Promise<IPCResult<void>>,
  openFileExternal: (relPath: string) => ipcRenderer.invoke('file:openExternal', relPath) as Promise<IPCResult<void>>,
  openRoot: () => ipcRenderer.invoke('root:open') as Promise<IPCResult<void>>,
  chooseRoot: () => ipcRenderer.invoke('root:choose') as Promise<IPCResult<string | null>>,
  getPrefs: () => ipcRenderer.invoke('prefs:get') as Promise<IPCResult<Prefs>>,
  setPrefs: (patch: Partial<Prefs>) => ipcRenderer.invoke('prefs:set', patch) as Promise<IPCResult<Prefs>>,
  createNote: ((folderName: string, baseName?: string) =>
    ipcRenderer.invoke('file:createNote', folderName, baseName) as Promise<IPCResult<NoteResult>>) as FolderDockBridge['createNote'],
  startDrag: (relPath: string) => ipcRenderer.send('drag:start', relPath),
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggleMaximize'),
  close: () => ipcRenderer.send('window:close'),
  widen: (width: number) => ipcRenderer.send('window:widen', width),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  onLibraryChanged: (cb: () => void) => {
    const listener = (): void => cb()
    ipcRenderer.on('library:changed', listener)
    return () => {
      ipcRenderer.removeListener('library:changed', listener)
    }
  },
  onWindowMaximized: (cb: (maximized: boolean) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, maximized: boolean): void => cb(maximized)
    ipcRenderer.on('window:maximized', listener)
    return () => {
      ipcRenderer.removeListener('window:maximized', listener)
    }
  }
}

contextBridge.exposeInMainWorld('folderdock', api)
