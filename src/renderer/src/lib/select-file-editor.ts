export interface SelectedFileItem {
  id: string
  name: string
  path: string
  content?: string
  language?: string
}

export interface EditorFileNode {
  name: string
  path: string
}

export interface EditorDocumentNode {
  name: string
  content: string
}

export interface EditorPluginNode {
  name: string
}

export function editorDocumentToPlainText(_node: EditorDocumentNode): string {
  return ''
}
