import * as React from 'react'
import { useState as useLocalState } from 'react'
import { getDroppedLocalPaths } from '@renderer/lib/drag-folder'
import { INTERNAL_FILE_DRAG_MIME } from './types'

interface UseDragDropOptions {
  addFilesToEditor: (filePaths: string[], selection?: { start: number; end: number }) => void
}

export function useDragDrop({ addFilesToEditor }: UseDragDropOptions) {
  const [dragging, setDragging] = useLocalState(false)

  const getDraggedFilePaths = React.useCallback((dataTransfer: DataTransfer | null): string[] => {
    if (!dataTransfer) return []
    const payload = dataTransfer.getData(INTERNAL_FILE_DRAG_MIME)
    if (!payload) return []

    try {
      const parsed = JSON.parse(payload)
      if (!Array.isArray(parsed)) return []
      return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
    } catch {
      return []
    }
  }, [])

  const handleDropFiles = React.useCallback(
    (dataTransfer: DataTransfer | null) => {
      if (!dataTransfer || dataTransfer.files.length === 0) return
      const paths = getDroppedLocalPaths(dataTransfer)
      const fallbackPaths = Array.from(dataTransfer.files)
        .map((f) => (f as File & { path?: string }).path)
        .filter((filePath): filePath is string => Boolean(filePath))
      const uniquePaths = Array.from(new Set([...paths, ...fallbackPaths]))

      if (uniquePaths.length > 0) {
        addFilesToEditor(uniquePaths)
      }
    },
    [addFilesToEditor]
  )

  const handleDragOver = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>): void => {
      const transfer = e.dataTransfer
      const types = Array.from(transfer?.types ?? [])
      const canHandle = types.includes('Files') || types.includes(INTERNAL_FILE_DRAG_MIME)
      if (!canHandle) return
      e.preventDefault()
      if (transfer) {
        transfer.dropEffect = 'copy'
      }
      setDragging(true)
    },
    [setDragging]
  )

  const handleDragLeave = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>): void => {
      const nextTarget = e.relatedTarget as Node | null
      if (nextTarget && e.currentTarget.contains(nextTarget)) return
      setDragging(false)
    },
    [setDragging]
  )

  const handleDropWrapped = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>): void => {
      const draggedPaths = getDraggedFilePaths(e.dataTransfer)
      const hasNativeFiles = (e.dataTransfer?.files?.length ?? 0) > 0
      if (draggedPaths.length === 0 && !hasNativeFiles) return
      e.preventDefault()
      setDragging(false)
      if (draggedPaths.length > 0) {
        addFilesToEditor(draggedPaths)
        return
      }
      handleDropFiles(e.dataTransfer ?? null)
    },
    [addFilesToEditor, getDraggedFilePaths, handleDropFiles, setDragging]
  )

  return {
    dragging,
    handleDragOver,
    handleDragLeave,
    handleDropWrapped
  }
}
