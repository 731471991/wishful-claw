import * as React from 'react'
import type { SelectedFileItem } from '@renderer/lib/select-file-editor'
import type { FileSearchItem, SlashSuggestionItem } from './types'

interface UseComposerKeydownOptions {
  isOptimizingLocked: boolean
  fileMenuOpen: boolean
  slashMenuOpen: boolean
  fileSearchResults: FileSearchItem[]
  selectedFileSearchIndex: number
  setSelectedFileSearchIndex: React.Dispatch<React.SetStateAction<number>>
  filteredSlashSuggestions: SlashSuggestionItem[]
  selectedSlashIndex: number
  setSelectedSlashIndex: React.Dispatch<React.SetStateAction<number>>
  activeFileMention: { start: number } | null
  editorRef: React.RefObject<{ focus: () => void; setSelectionOffsets: (start: number, end: number) => void } | null>
  setEditorSelection: (selection: { start: number; end: number }) => void
  insertSelectedFile: (path: string) => void
  applySlashSuggestion: (item: SlashSuggestionItem) => void
  acceptSuggestion: () => string | null
  applyEditorStateFromSerializedText: (text: string, files: SelectedFileItem[]) => void
  selectedFiles: SelectedFileItem[]
  focusInputAtEnd: () => void
  handleRecommendationSelectionChange: () => void
  handleSend: () => void
}

export function useComposerKeydown(opts: UseComposerKeydownOptions) {
  return React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>): void => {
      const {
        isOptimizingLocked,
        fileMenuOpen, slashMenuOpen,
        fileSearchResults, selectedFileSearchIndex, setSelectedFileSearchIndex,
        filteredSlashSuggestions, selectedSlashIndex, setSelectedSlashIndex,
        activeFileMention, editorRef, setEditorSelection,
        insertSelectedFile, applySlashSuggestion,
        acceptSuggestion, applyEditorStateFromSerializedText,
        selectedFiles, focusInputAtEnd, handleRecommendationSelectionChange, handleSend
      } = opts

      // keyCode 229 marks the keydown that starts an IME composition
      if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229 || isOptimizingLocked) return

      if (fileMenuOpen) {
        if (!e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedFileSearchIndex((prev) =>
            fileSearchResults.length === 0 ? 0 : (prev + 1) % fileSearchResults.length
          )
          return
        }
        if (!e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedFileSearchIndex((prev) =>
            fileSearchResults.length === 0
              ? 0
              : (prev - 1 + fileSearchResults.length) % fileSearchResults.length
          )
          return
        }
        if (!e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'Tab' || e.key === 'Enter')) {
          const selectedFile = fileSearchResults[selectedFileSearchIndex]
          if (selectedFile) {
            e.preventDefault()
            insertSelectedFile(selectedFile.path)
            return
          }
        }
        if (!e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'Escape') {
          e.preventDefault()
          const nextCursor = activeFileMention?.start ?? 0
          editorRef.current?.focus()
          editorRef.current?.setSelectionOffsets(nextCursor, nextCursor)
          setEditorSelection({ start: nextCursor, end: nextCursor })
          handleRecommendationSelectionChange()
          return
        }
      }

      if (slashMenuOpen) {
        if (!e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedSlashIndex((prev) =>
            filteredSlashSuggestions.length === 0 ? 0 : (prev + 1) % filteredSlashSuggestions.length
          )
          return
        }
        if (!e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedSlashIndex((prev) =>
            filteredSlashSuggestions.length === 0
              ? 0
              : (prev - 1 + filteredSlashSuggestions.length) % filteredSlashSuggestions.length
          )
          return
        }
        if (!e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'Tab' || e.key === 'Enter')) {
          const selectedSuggestion = filteredSlashSuggestions[selectedSlashIndex]
          if (selectedSuggestion) {
            e.preventDefault()
            applySlashSuggestion(selectedSuggestion)
            return
          }
        }
      }

      if (!e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key === 'Tab') {
        const acceptedSuggestion = acceptSuggestion()
        if (acceptedSuggestion) {
          e.preventDefault()
          applyEditorStateFromSerializedText(acceptedSuggestion, selectedFiles)
          requestAnimationFrame(() => {
            focusInputAtEnd()
            handleRecommendationSelectionChange()
          })
          return
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    // Re-build dependency array from all opts values that change
    [
      opts.isOptimizingLocked,
      opts.fileMenuOpen,
      opts.slashMenuOpen,
      opts.fileSearchResults,
      opts.selectedFileSearchIndex,
      opts.filteredSlashSuggestions,
      opts.selectedSlashIndex,
      opts.activeFileMention,
      opts.insertSelectedFile,
      opts.applySlashSuggestion,
      opts.acceptSuggestion,
      opts.applyEditorStateFromSerializedText,
      opts.selectedFiles,
      opts.focusInputAtEnd,
      opts.handleRecommendationSelectionChange,
      opts.handleSend
    ]
  )
}
