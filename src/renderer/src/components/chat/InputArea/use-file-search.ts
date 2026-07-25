import * as React from 'react'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { getSelectFileMentionQuery, createSelectFileToken } from '@renderer/lib/select-file-tags'
import { ensureSelectedFile, type SelectedFileItem } from '@renderer/lib/select-file-editor'
import type { FileSearchItem } from './types'

interface UseFileSearchOptions {
  text: string
  editorSelection: { start: number; end: number }
  projectScoped: boolean
  workingFolder?: string
  selectedFilesRef: React.RefObject<SelectedFileItem[]>
  replaceSelectionWithText: (
    replacement: string,
    selection?: { start: number; end: number },
    cursorOffset?: number,
    nextSelectedFiles?: SelectedFileItem[]
  ) => void
  setSelectedSkill: (name: string | null) => void
  fileListRef: React.RefObject<HTMLDivElement | null>
}

export function useFileSearch(opts: UseFileSearchOptions) {
  const [fileSearchResults, setFileSearchResults] = React.useState<FileSearchItem[]>([])
  const [fileSearchLoading, setFileSearchLoading] = React.useState(false)
  const [selectedFileSearchIndex, setSelectedFileSearchIndex] = React.useState(0)

  const activeFileMention = React.useMemo(() => {
    if (opts.editorSelection.start === opts.editorSelection.end) {
      const selectionMention = getSelectFileMentionQuery(opts.text, opts.editorSelection.end)
      if (selectionMention) return selectionMention
    }
    return getSelectFileMentionQuery(opts.text, opts.text.length)
  }, [opts.editorSelection.end, opts.editorSelection.start, opts.text])

  const fileQuery = activeFileMention?.query.trim() ?? ''
  const fileMenuOpen = opts.projectScoped && Boolean(activeFileMention)

  React.useEffect(() => {
    setSelectedFileSearchIndex(0)
  }, [fileQuery])

  React.useEffect(() => {
    if (!fileMenuOpen) return
    const items = opts.fileListRef.current?.querySelectorAll('button')
    items?.[selectedFileSearchIndex]?.scrollIntoView({ block: 'nearest' })
  }, [selectedFileSearchIndex, fileMenuOpen])

  React.useEffect(() => {
    if (!fileMenuOpen || !opts.workingFolder) {
      setFileSearchResults([])
      setFileSearchLoading(false)
      return
    }

    let cancelled = false
    setFileSearchLoading(true)

    const timer = window.setTimeout(() => {
      void ipcClient
        .invoke('fs:search-files', {
          path: opts.workingFolder,
          query: fileQuery,
          limit: 20
        })
        .then((result) => {
          if (cancelled) return
          setFileSearchResults(Array.isArray(result) ? (result as FileSearchItem[]) : [])
        })
        .finally(() => { if (!cancelled) setFileSearchLoading(false) })
    }, 120)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [fileMenuOpen, fileQuery, opts.workingFolder])

  const insertSelectedFile = React.useCallback(
    (filePath: string) => {
      opts.setSelectedSkill(null)

      const { files: nextFiles, file } = ensureSelectedFile(
        opts.selectedFilesRef.current,
        filePath,
        opts.workingFolder
      )
      if (!file) return

      const mention = activeFileMention ?? {
        start: opts.editorSelection.start,
        end: opts.editorSelection.end
      }
      const suffix =
        opts.text.slice(mention.end).startsWith(' ') ||
        opts.text.slice(mention.end).startsWith('\n') ||
        mention.end >= opts.text.length
          ? ''
          : ' '

      opts.replaceSelectionWithText(
        `${createSelectFileToken(file.sendPath)}${suffix}`,
        mention,
        0,
        nextFiles
      )
    },
    [activeFileMention, opts]
  )

  return {
    fileSearchResults, fileSearchLoading, fileSearchResults_setResults: setFileSearchResults,
    selectedFileSearchIndex, setSelectedFileSearchIndex,
    activeFileMention, fileQuery, fileMenuOpen,
    insertSelectedFile
  }
}
