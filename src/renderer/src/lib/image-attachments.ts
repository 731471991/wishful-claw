import type { ImageBlock } from '@renderer/lib/api/types'

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

export interface ImageAttachment {
  id: string
  file: File
  dataUrl: string
  mediaType: string
}

export interface EditableUserMessageDraft {
  text: string
  imageAttachments: ImageAttachment[]
}

export function fileToImageAttachment(_file: File): Promise<ImageAttachment> {
  return Promise.reject(new Error('Not implemented'))
}

export function imageBlockToAttachment(_block: ImageBlock): ImageAttachment | null {
  return null
}

export function cloneImageAttachments(attachments: ImageAttachment[]): ImageAttachment[] {
  return attachments
}

export function extractEditableUserMessageDraft(_message: unknown): EditableUserMessageDraft | null {
  return null
}

export function isEditableUserMessage(_message: unknown): boolean {
  return false
}

export function hasEditableDraftContent(_draft: EditableUserMessageDraft): boolean {
  return false
}
