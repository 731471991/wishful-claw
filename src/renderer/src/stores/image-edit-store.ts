import { create } from 'zustand'
import { cloneImageAttachments, type ImageAttachment } from '@renderer/lib/image-attachments'

export type ImageEditMode = 'edit' | 'mask'

interface ImageEditSessionState {
  open: boolean
  sessionId: string | null
  image: ImageAttachment | null
  mode: ImageEditMode
  openEditor: (args: { sessionId: string; image: ImageAttachment; mode?: ImageEditMode }) => void
  closeEditor: () => void
}

export const useImageEditStore = create<ImageEditSessionState>()((set) => ({
  open: false,
  sessionId: null,
  image: null,
  mode: 'edit',
  openEditor: ({ sessionId, image, mode = 'edit' }) =>
    set({
      open: true,
      sessionId,
      image: cloneImageAttachments([image])[0] ?? null,
      mode
    }),
  closeEditor: () =>
    set({
      open: false,
      sessionId: null,
      image: null,
      mode: 'edit'
    })
}))
