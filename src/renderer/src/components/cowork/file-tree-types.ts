// --- Types ---

export interface FileEntry {
  name: string
  type: 'file' | 'directory'
  path: string
}

export interface TreeNode extends FileEntry {
  children?: TreeNode[]
  loaded?: boolean
  expanded?: boolean
}

export interface AgentFileTreeCommand {
  id: number
  type: 'new-file' | 'new-folder' | 'refresh' | 'collapse-all'
}

export interface FileSearchItem {
  name: string
  path: string
}

export interface TreeEditState {
  renamingPath: string | null
  newItemParent: string | null
  newItemType: 'file' | 'directory'
}

export interface TreeActions {
  localActionsAvailable: boolean
  onDelete: (nodePath: string, nodeName: string, isDir: boolean) => void
  onRenameStart: (nodePath: string, nodeName: string) => void
  onRenameConfirm: (value: string) => void
  onRenameCancel: () => void
  onAddToChat: (nodePath: string) => void
  onCopyPath: (nodePath: string) => void
  onPreview: (nodePath: string) => void
  onOpenDefault: (nodePath: string) => void
  onOpenTerminal: (nodePath: string, isDir: boolean) => void
  onOpenWithCode: (nodePath: string) => void
  onReveal: (nodePath: string) => void
  onNewFile: (dirPath: string) => void
  onNewFolder: (dirPath: string) => void
  onNewItemConfirm: (value: string) => void
  onNewItemCancel: () => void
  onRefresh: (dirPath: string) => void
}
