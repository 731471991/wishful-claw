// Stub: input draft types

export interface InputDraftEntry { [key: string]: unknown }
export interface InputDraftSnapshot { [key: string]: unknown }

// ─── Auto stubs ───
export type InputDraftContext = Record<string, unknown>
export type InputDraftIndexEntry = Record<string, unknown>
export type InputDraftMutationResult = Record<string, unknown>

export interface InputDraftImage {
  id: string
  dataUrl: string
  mediaType: string
}

export interface InputDraftSelectedFile {
  id: string
  name: string
  originalPath: string
  sendPath: string
  previewPath: string
  isWorkspaceFile: boolean
}

export interface InputDraftValue {
  text: string
  images: InputDraftImage[]
  skill: string | null
  selectedFiles: InputDraftSelectedFile[]
}

export interface InputDraftSetArgs {
  draftKey: string
  draft: InputDraftValue
}

export type InputDraftRecord = InputDraftValue
