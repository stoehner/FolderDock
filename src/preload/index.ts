import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { FolderDockBridge } from '../shared/api'
import { CHANNELS, EVENTS, SEND } from '../shared/channels'
import type {
  BackupEntry,
  BackupResult,
  ContentMatch,
  DetailedFileMeta,
  ImportResult,
  MoveOutOutcome,
  LibrarySnapshot,
  Prefs,
  TextFileContent,
  UpdateStateView,
  WriteTextRequest,
  WriteTextResult,
  IPCResult
} from '../shared/types'

type NoteResult = { relPath: string; mtimeMs: number }
type AppInfo = { version: string; electron: string; root: string; overridden: boolean; defaultRoot: string | null }

function invoke<T>(channel: string, ...args: unknown[]): Promise<IPCResult<T>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IPCResult<T>>
}

const api: FolderDockBridge = {
  appInfo: () => invoke<AppInfo>(CHANNELS.appInfo),
  scan: () => invoke<LibrarySnapshot>(CHANNELS.scan),
  searchContent: (query: string) => invoke<ContentMatch[]>(CHANNELS.searchContent, query),
  createFolder: (name: string) => invoke<LibrarySnapshot>(CHANNELS.createFolder, name),
  renameFolder: (oldName: string, newName: string) => invoke<LibrarySnapshot>(CHANNELS.renameFolder, oldName, newName),
  deleteFolder: (name: string) => invoke<LibrarySnapshot>(CHANNELS.deleteFolder, name),
  readTextFile: (relPath: string) => invoke<TextFileContent>(CHANNELS.readTextFile, relPath),
  writeTextFile: (req: WriteTextRequest) => invoke<WriteTextResult>(CHANNELS.writeTextFile, req),
  readBytes: (relPath: string, maxBytes: number) => invoke<ArrayBuffer>(CHANNELS.readBytes, relPath, maxBytes),
  excerpt: (relPath: string) => invoke<string>(CHANNELS.excerpt, relPath),
  fileMeta: (relPath: string) => invoke<DetailedFileMeta>(CHANNELS.fileMeta, relPath),
  renameFile: (relPath: string, newName: string) => invoke<LibrarySnapshot>(CHANNELS.renameFile, relPath, newName),
  moveFile: (relPath: string, targetFolder: string) => invoke<LibrarySnapshot>(CHANNELS.moveFile, relPath, targetFolder),
  deleteFile: (relPath: string) => invoke<LibrarySnapshot>(CHANNELS.deleteFile, relPath),
  moveFileOut: (relPath: string, destination: string) =>
    invoke<MoveOutOutcome>(CHANNELS.moveFileOut, relPath, destination),
  chooseMoveOut: () => invoke<string | null>(CHANNELS.chooseMoveOut),
  dropFiles: (paths: string[], targetFolder: string) => invoke<ImportResult>(CHANNELS.dropFiles, paths, targetFolder),
  chooseAndImport: (targetFolder: string) => invoke<ImportResult>(CHANNELS.chooseAndImport, targetFolder),
  revealFile: (relPath: string) => invoke<void>(CHANNELS.revealFile, relPath),
  openFileExternal: (relPath: string) => invoke<void>(CHANNELS.openFileExternal, relPath),
  openRoot: () => invoke<void>(CHANNELS.openRoot),
  chooseRoot: () => invoke<string | null>(CHANNELS.chooseRoot),
  chooseBackupFolder: () => invoke<string | null>(CHANNELS.chooseBackupFolder),
  backupLibrary: () => invoke<BackupResult>(CHANNELS.backupLibrary),
  listBackups: () => invoke<BackupEntry[]>(CHANNELS.listBackups),
  deleteBackup: (name: string) => invoke<void>(CHANNELS.deleteBackup, name),
  getPrefs: () => invoke<Prefs>(CHANNELS.getPrefs),
  setPrefs: (patch: Partial<Prefs>) => invoke<Prefs>(CHANNELS.setPrefs, patch),
  updateState: () => invoke<UpdateStateView>(CHANNELS.updatesGetState),
  checkForUpdates: () => invoke<UpdateStateView>(CHANNELS.updatesCheckNow),
  installUpdate: () => invoke<void>(CHANNELS.updatesInstall),
  openUpdateReleases: () => invoke<void>(CHANNELS.updatesOpenReleases),
  createNote: (folderName: string, baseName?: string) => invoke<NoteResult>(CHANNELS.createNote, folderName, baseName),
  startDrag: (relPath: string, additionalFiles?: string[]) => ipcRenderer.send(SEND.startDrag, relPath, additionalFiles),
  minimize: () => ipcRenderer.send(SEND.minimize),
  toggleMaximize: () => ipcRenderer.send(SEND.toggleMaximize),
  close: () => ipcRenderer.send(SEND.close),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  onLibraryChanged: (cb: () => void) => {
    const listener = (): void => cb()
    ipcRenderer.on(EVENTS.libraryChanged, listener)
    return () => {
      ipcRenderer.removeListener(EVENTS.libraryChanged, listener)
    }
  },
  onWindowMaximized: (cb: (maximized: boolean) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, maximized: boolean): void => cb(maximized)
    ipcRenderer.on(EVENTS.windowMaximized, listener)
    return () => {
      ipcRenderer.removeListener(EVENTS.windowMaximized, listener)
    }
  },
  onUpdateStatus: (cb: (state: UpdateStateView) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, state: UpdateStateView): void => cb(state)
    ipcRenderer.on(EVENTS.updatesStatus, listener)
    return () => {
      ipcRenderer.removeListener(EVENTS.updatesStatus, listener)
    }
  }
}

contextBridge.exposeInMainWorld('folderdock', api)
