import * as React from 'react'
import { cn } from '@renderer/lib/utils'
import {
import {
  type EditorSelectionOffsets,
  type FileAwareEditorHandle,
  type FileAwareEditorProps,
  appendTextContent,
  getFileChipLabel,
  buildFileChip,
  buildPluginChip,
  renderDocument,
  collectTextContent,
  isSameDocument,
  parseDomToDocument,
  getSelectionOffsets,
  setSelectionFromPoint,
  setSelectionOffsets
} from './file-aware-editor-utils'

export const FileAwareEditor = React.forwardRef<FileAwareEditorHandle, FileAwareEditorProps>(
  function FileAwareEditor(
    {
      document,
      files,
      disabled = false,
      placeholder,
      suggestionText,
      showSuggestion = false,
      highlightedFileId,
      onDocumentChange,
      onSelectionChange,
      onFocus,
      onBlur,
      onKeyDown,
      onPaste,
      onCompositionStart,
      onCompositionEnd,
      onReferencePreview,
      onReferenceLocate,
      onReferenceDelete,
      className
    },
    ref
  ) {
    const editorRef = React.useRef<HTMLDivElement>(null)
    const suggestionOverlayRef = React.useRef<HTMLDivElement>(null)
    const selectionRef = React.useRef<EditorSelectionOffsets>({ start: 0, end: 0 })
    const focusedRef = React.useRef(false)
    const selectionSyncFrameRef = React.useRef<number | null>(null)
    const documentSyncFrameRef = React.useRef<number | null>(null)
    const compositionEndRafRef = React.useRef<number | null>(null)
    const isComposingRef = React.useRef(false)
    const pendingRenderAfterCompositionRef = React.useRef(false)
    const [compositionRenderVersion, bumpCompositionRenderVersion] = React.useReducer(
      (version: number) => version + 1,
      0
    )
    const handlersRef = React.useRef<
      Pick<FileAwareEditorProps, 'onReferencePreview' | 'onReferenceLocate' | 'onReferenceDelete'>
    >({})
    const lastRenderedHighlightRef = React.useRef<string | null | undefined>(undefined)

    React.useEffect(() => {
      handlersRef.current = {
        onReferencePreview,
        onReferenceLocate,
        onReferenceDelete
      }
    }, [onReferenceDelete, onReferenceLocate, onReferencePreview])

    const syncSelection = React.useCallback(() => {
      const root = editorRef.current
      if (!root) return selectionRef.current
      const selection = getSelectionOffsets(root, files, selectionRef.current)
      selectionRef.current = selection
      onSelectionChange?.(selection)
      return selection
    }, [files, onSelectionChange])

    const scheduleSelectionSync = React.useCallback(() => {
      if (selectionSyncFrameRef.current !== null) {
        window.cancelAnimationFrame(selectionSyncFrameRef.current)
      }
      selectionSyncFrameRef.current = window.requestAnimationFrame(() => {
        selectionSyncFrameRef.current = null
        syncSelection()
      })
    }, [syncSelection])

    React.useEffect(() => {
      const handleSelectionChange = (): void => {
        const root = editorRef.current
        const selection = window.getSelection()
        if (!root || !selection || selection.rangeCount === 0) return
        const range = selection.getRangeAt(0)
        if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return
        scheduleSelectionSync()
      }

      window.document.addEventListener('selectionchange', handleSelectionChange)
      return () => {
        window.document.removeEventListener('selectionchange', handleSelectionChange)
        if (selectionSyncFrameRef.current !== null) {
          window.cancelAnimationFrame(selectionSyncFrameRef.current)
        }
        if (documentSyncFrameRef.current !== null) {
          window.cancelAnimationFrame(documentSyncFrameRef.current)
        }
        if (compositionEndRafRef.current !== null) {
          window.cancelAnimationFrame(compositionEndRafRef.current)
        }
      }
    }, [scheduleSelectionSync])

    React.useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          const root = editorRef.current
          if (!root) return
          root.focus()
          focusedRef.current = true
          const selection = window.getSelection()
          const hasEditorSelection =
            selection &&
            selection.rangeCount > 0 &&
            root.contains(selection.getRangeAt(0).startContainer) &&
            root.contains(selection.getRangeAt(0).endContainer)
          if (!hasEditorSelection) {
            setSelectionOffsets(root, selectionRef.current.start, selectionRef.current.end)
          }
        },
        focusAtEnd: () => {
          const root = editorRef.current
          if (!root) return
          root.focus()
          focusedRef.current = true
          const plainText = editorDocumentToPlainText(document, files)
          selectionRef.current = { start: plainText.length, end: plainText.length }
          setSelectionOffsets(root, plainText.length, plainText.length)
          onSelectionChange?.(selectionRef.current)
        },
        setSelectionOffsets: (start, end = start) => {
          const root = editorRef.current
          if (!root) return
          selectionRef.current = { start, end }
          setSelectionOffsets(root, start, end)
          onSelectionChange?.(selectionRef.current)
        },
        getSelectionOffsets: () => {
          const root = editorRef.current
          if (!root) return selectionRef.current
          return getSelectionOffsets(root, files, selectionRef.current)
        },
        getDocumentSnapshot: () => {
          const root = editorRef.current
          if (!root) return document
          return parseDomToDocument(root)
        },
        getScrollMetrics: () => {
          const root = editorRef.current
          return {
            scrollHeight: root?.scrollHeight ?? 0,
            clientHeight: root?.clientHeight ?? 0
          }
        },
        scrollToReference: (fileId: string) => {
          const root = editorRef.current
          if (!root) return false
          const target = root.querySelector(
            `[data-file-id="${CSS.escape(fileId)}"]`
          ) as HTMLElement | null
          if (!target) return false
          target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
          return true
        }
      }),
      [document, files, onSelectionChange]
    )

    React.useLayoutEffect(() => {
      const root = editorRef.current
      if (!root) return

      if (isComposingRef.current) {
        pendingRenderAfterCompositionRef.current = true
        return
      }

      const currentDocument = parseDomToDocument(root)
      const highlightChanged = lastRenderedHighlightRef.current !== highlightedFileId
      const shouldRender = highlightChanged || !isSameDocument(currentDocument, document)

      if (!shouldRender) {
        return
      }

      renderDocument(root, document, files, {
        ...handlersRef.current,
        highlightedFileId
      })
      lastRenderedHighlightRef.current = highlightedFileId

      if (!focusedRef.current) return
      const selection = selectionRef.current
      setSelectionOffsets(root, selection.start, selection.end)
    }, [compositionRenderVersion, document, files, highlightedFileId])

    const flushDocumentSync = React.useCallback(() => {
      const root = editorRef.current
      if (!root) return
      const nextDocument = parseDomToDocument(root)
      if (!isSameDocument(nextDocument, document)) {
        onDocumentChange(nextDocument)
      }
    }, [document, onDocumentChange])

    const handleInput = React.useCallback(
      (event: React.FormEvent<HTMLDivElement>) => {
        const nativeEvent = event.nativeEvent as Event & { isComposing?: boolean }
        if (isComposingRef.current || nativeEvent.isComposing) {
          return
        }

        syncSelection()
        if (documentSyncFrameRef.current !== null) {
          window.cancelAnimationFrame(documentSyncFrameRef.current)
          documentSyncFrameRef.current = null
        }
        flushDocumentSync()
      },
      [flushDocumentSync, syncSelection]
    )

    const handleCompositionStartInternal = React.useCallback(
      (event: React.CompositionEvent<HTMLDivElement>) => {
        isComposingRef.current = true
        if (documentSyncFrameRef.current !== null) {
          window.cancelAnimationFrame(documentSyncFrameRef.current)
          documentSyncFrameRef.current = null
        }
        onCompositionStart?.(event)
      },
      [onCompositionStart]
    )

    const handleCompositionUpdateInternal = React.useCallback(() => {
      pendingRenderAfterCompositionRef.current = true
    }, [])

    const handleCompositionEndInternal = React.useCallback(
      (event: React.CompositionEvent<HTMLDivElement>) => {
        isComposingRef.current = false
        onCompositionEnd?.(event)
        if (documentSyncFrameRef.current !== null) {
          window.cancelAnimationFrame(documentSyncFrameRef.current)
          documentSyncFrameRef.current = null
        }
        // Defer flush to next animation frame. On Windows, some IMEs (Microsoft
        // Pinyin, Sogou, etc.) update the DOM AFTER compositionend fires, so
        // reading the DOM synchronously here captures intermediate pinyin state.
        // requestAnimationFrame fires after the browser has finished updating
        // the DOM and after the subsequent 'input' event, ensuring we read the
        // final composed text.
        if (compositionEndRafRef.current !== null) {
          window.cancelAnimationFrame(compositionEndRafRef.current)
        }
        compositionEndRafRef.current = window.requestAnimationFrame(() => {
          compositionEndRafRef.current = null
          flushDocumentSync()
          scheduleSelectionSync()
          if (pendingRenderAfterCompositionRef.current) {
            pendingRenderAfterCompositionRef.current = false
            bumpCompositionRenderVersion()
          }
        })
      },
      [flushDocumentSync, onCompositionEnd, scheduleSelectionSync]
    )

    const plainText = React.useMemo(
      () => editorDocumentToPlainText(document, files),
      [document, files]
    )
    const hasContent = document.length > 0 && plainText.length > 0

    return (
      <div className={cn('relative flex min-h-0 min-w-0 flex-col overflow-hidden', className)}>
        {!hasContent && placeholder && (
          <div className="composer-editor-placeholder pointer-events-none absolute inset-0 p-2 pb-12 pr-3 text-base md:text-sm">
            {placeholder}
          </div>
        )}
        {showSuggestion && suggestionText && plainText.length > 0 && (
          <div
            ref={suggestionOverlayRef}
            className="composer-editor-suggestion pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words p-2 pb-12 pr-3 text-base md:text-sm"
          >
            <span className="invisible">{plainText}</span>
            <span>{suggestionText}</span>
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          spellCheck={false}
          data-gramm="false"
          className="composer-editor-content block min-h-[60px] min-w-0 max-h-full flex-1 overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words p-2 pb-12 pr-3 text-base outline-none md:text-sm"
          style={{ scrollbarGutter: 'stable' }}
          onInput={handleInput}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onFocus={() => {
            focusedRef.current = true
            onFocus?.()
            scheduleSelectionSync()
          }}
          onBlur={() => {
            focusedRef.current = false
            isComposingRef.current = false
            onBlur?.()
          }}
          onClick={() => {
            scheduleSelectionSync()
          }}
          onKeyUp={() => {
            scheduleSelectionSync()
          }}
          onMouseDown={(event) => {
            if (event.button !== 2) return
            setSelectionFromPoint(event.currentTarget, event.clientX, event.clientY)
            scheduleSelectionSync()
          }}
          onDragOver={(event) => {
            if (disabled) return
            if (setSelectionFromPoint(event.currentTarget, event.clientX, event.clientY)) {
              syncSelection()
            }
          }}
          onDrop={(event) => {
            if (disabled) return
            if (setSelectionFromPoint(event.currentTarget, event.clientX, event.clientY)) {
              syncSelection()
            }
          }}
          onMouseUp={() => {
            scheduleSelectionSync()
          }}
          onContextMenu={(event) => {
            setSelectionFromPoint(event.currentTarget, event.clientX, event.clientY)
            scheduleSelectionSync()
          }}
          onScroll={(event) => {
            if (!suggestionOverlayRef.current) return
            suggestionOverlayRef.current.scrollTop = event.currentTarget.scrollTop
            suggestionOverlayRef.current.scrollLeft = event.currentTarget.scrollLeft
          }}
          onCompositionStart={handleCompositionStartInternal}
          onCompositionUpdate={handleCompositionUpdateInternal}
          onCompositionEnd={handleCompositionEndInternal}
          role="textbox"
          aria-multiline="true"
        />
      </div>
    )
  }
)
