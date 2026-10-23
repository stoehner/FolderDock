import { useUI, type Modal } from '../state/ui'
import { EditorModal } from './Editor'
import { NewFolderModal } from './modals/NewFolderModal'
import { RenameFolderModal } from './modals/RenameFolderModal'
import { RenameFileModal } from './modals/RenameFileModal'
import { ConfirmModal } from './modals/ConfirmModal'
import { MoveFileModal } from './modals/MoveFileModal'
import { MoveFilesModal } from './modals/MoveFilesModal'
import { RecolorFolderModal } from './modals/RecolorFolderModal'
import { BackupsModal } from './modals/BackupsModal'
import { HelpModal } from './modals/HelpModal'
import { SettingsModal } from './modals/SettingsModal'

const ROUTES: {
  [K in Exclude<Modal, { type: 'editor' }>['type']]: (modal: Extract<Modal, { type: K }>) => React.ReactNode
} = {
  'new-folder': m => <NewFolderModal art={m.art} />,
  'rename-folder': m => <RenameFolderModal folder={m.folder} />,
  'rename-file': m => <RenameFileModal relPath={m.relPath} />,
  confirm: m => <ConfirmModal modal={m} />,
  'move-file': m => <MoveFileModal relPath={m.relPath} />,
  'move-files': m => <MoveFilesModal relPaths={m.relPaths} />,
  'recolor-folder': m => <RecolorFolderModal folder={m.folder} />,
  backups: () => <BackupsModal />,
  help: () => <HelpModal />,
  settings: () => <SettingsModal />
}

export function ModalLayer() {
  const modal = useUI(s => s.modal)
  const editor = useUI(s => s.editor)
  if (!modal) return null

  if (modal.type === 'editor') {
    return editor ? (
      <div className="modal-layer" data-editor-layer="true">
        <EditorModal />
      </div>
    ) : null
  }

  return (
    <div
      className="modal-layer"
      onClick={e => {
        if (e.target === e.currentTarget) useUI.getState().closeModal()
      }}
    >
      {ROUTES[modal.type](modal as never)}
    </div>
  )
}
