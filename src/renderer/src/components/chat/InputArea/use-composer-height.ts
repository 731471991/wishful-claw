// Composer height management hook for InputArea
// Manages drag-resize, auto-height, and layout clamping

import * as React from 'react'
import type { FileAwareEditorHandle } from '../file-aware-editor-utils'
import type { EditorDocumentNode, SelectedFileItem } from '@renderer/lib/select-file-editor'
import {
  MIN_INPUT_HEIGHT,
  MAX_INPUT_HEIGHT,
  MIN_MESSAGE_LIST_HEIGHT,
  EDITOR_MIN_HEIGHT,
  FALLBACK_MAX_VIEWPORT_RATIO
} from './types'

export interface UseComposerHeightOptions {
  isSessionComposer: boolean
  defaultSessionInputHeight: number
  editorRef: React.RefObject<FileAwareEditorHandle | null>
  /** Triggers height recalculation when image count changes */
  attachedImagesCount: number
  /** Triggers height recalculation when skill tag toggles */
  selectedSkill: string | null
  /** Triggers auto-height sync when editor content changes */
  documentNodes: EditorDocumentNode[]
  /** Triggers auto-height sync when file references change */
  selectedFiles: SelectedFileItem[]
}

export function useComposerHeight(opts: UseComposerHeightOptions) {
  const {
    isSessionComposer,
    defaultSessionInputHeight,
    editorRef,
    attachedImagesCount,
    selectedSkill,
    documentNodes,
    selectedFiles
  } = opts

  const minComposerHeight = MIN_INPUT_HEIGHT

  const rootRef = React.useRef<HTMLDivElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const imagePreviewRef = React.useRef<HTMLDivElement>(null)
  const bottomToolbarRef = React.useRef<HTMLDivElement>(null)
  const dragRef = React.useRef<{
    startY: number
    startH: number
    minH: number
    maxH: number
  } | null>(null)

  const [inputHeight, setInputHeight] = React.useState<number | null>(() =>
    isSessionComposer ? defaultSessionInputHeight : null
  )
  const [autoInputHeight, setAutoInputHeight] = React.useState<number>(() => minComposerHeight)
  const [autoMaxInputHeight, setAutoMaxInputHeight] = React.useState(() =>
    Math.max(
      MIN_INPUT_HEIGHT,
      Math.min(MAX_INPUT_HEIGHT, Math.floor(window.innerHeight * FALLBACK_MAX_VIEWPORT_RATIO))
    )
  )

  const getMaxInputHeight = React.useCallback(() => {
    const container = containerRef.current
    if (!container) {
      return Math.max(
        minComposerHeight,
        Math.min(MAX_INPUT_HEIGHT, Math.floor(window.innerHeight * FALLBACK_MAX_VIEWPORT_RATIO))
      )
    }
    const root = rootRef.current
    const messageListEl = root?.parentElement?.querySelector(
      '[data-message-list]'
    ) as HTMLElement | null
    if (messageListEl) {
      const messageListHeight = messageListEl.getBoundingClientRect().height
      const available = Math.max(0, messageListHeight - MIN_MESSAGE_LIST_HEIGHT)
      const dynamicMax = container.offsetHeight + available
      return Math.max(minComposerHeight, Math.min(MAX_INPUT_HEIGHT, Math.floor(dynamicMax)))
    }
    return Math.max(
      minComposerHeight,
      Math.min(MAX_INPUT_HEIGHT, Math.floor(window.innerHeight * FALLBACK_MAX_VIEWPORT_RATIO))
    )
  }, [minComposerHeight])

  const getMinInputHeight = React.useCallback(() => {
    const container = containerRef.current
    const editorMetrics = editorRef.current?.getScrollMetrics()
    const imagePreviewHeight = imagePreviewRef.current?.offsetHeight ?? 0
    const bottomToolbarHeight = bottomToolbarRef.current?.offsetHeight ?? 0
    const explicitChromeHeight = imagePreviewHeight + bottomToolbarHeight + 28

    if (!container || !editorMetrics) {
      return Math.max(minComposerHeight, explicitChromeHeight + EDITOR_MIN_HEIGHT)
    }

    const chromeHeight = Math.max(0, container.offsetHeight - editorMetrics.clientHeight)
    return Math.max(
      minComposerHeight,
      Math.ceil(Math.max(chromeHeight, explicitChromeHeight) + EDITOR_MIN_HEIGHT)
    )
  }, [editorRef, minComposerHeight])

  const syncAutoInputHeight = React.useCallback(() => {
    if (inputHeight !== null) return
    const container = containerRef.current
    const editorMetrics = editorRef.current?.getScrollMetrics()
    if (!container || !editorMetrics) return

    const chromeHeight = Math.max(0, container.offsetHeight - editorMetrics.clientHeight)
    const minHeight = Math.max(minComposerHeight, Math.ceil(chromeHeight + EDITOR_MIN_HEIGHT))
    const nextHeight = Math.max(
      minHeight,
      Math.min(
        autoMaxInputHeight,
        Math.ceil(chromeHeight + Math.max(EDITOR_MIN_HEIGHT, editorMetrics.scrollHeight))
      )
    )

    setAutoInputHeight((prev) => (prev === nextHeight ? prev : nextHeight))
  }, [autoMaxInputHeight, editorRef, inputHeight, minComposerHeight])

  // Set input height based on session composer mode
  React.useEffect(() => {
    setInputHeight((current) => {
      if (!isSessionComposer) {
        return current === null ? current : null
      }
      return current ?? defaultSessionInputHeight
    })
  }, [defaultSessionInputHeight, isSessionComposer])

  // Mouse drag handlers
  React.useEffect(() => {
    const onMouseMove = (e: MouseEvent): void => {
      if (!dragRef.current) return
      const delta = dragRef.current.startY - e.clientY
      const newH = Math.min(
        dragRef.current.maxH,
        Math.max(dragRef.current.minH, dragRef.current.startH + delta)
      )
      setInputHeight(newH)
    }
    const onMouseUp = (): void => {
      if (dragRef.current) {
        dragRef.current = null
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // Clamp input height on window resize
  React.useEffect(() => {
    if (inputHeight === null) return
    const clampInputHeight = (): void => {
      const minH = getMinInputHeight()
      const maxH = Math.max(minH, getMaxInputHeight())
      setInputHeight((prev) => {
        if (prev === null) return prev
        return Math.min(Math.max(prev, minH), maxH)
      })
    }
    clampInputHeight()
    window.addEventListener('resize', clampInputHeight)
    return () => window.removeEventListener('resize', clampInputHeight)
  }, [getMaxInputHeight, getMinInputHeight, inputHeight])

  // Update auto max height via ResizeObserver
  React.useEffect(() => {
    const updateAutoMaxInputHeight = (): void => {
      setAutoMaxInputHeight(getMaxInputHeight())
    }

    updateAutoMaxInputHeight()

    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            updateAutoMaxInputHeight()
          })
    const container = containerRef.current
    const root = rootRef.current
    const messageListEl = root?.parentElement?.querySelector(
      '[data-message-list]'
    ) as HTMLElement | null

    if (observer && container) {
      observer.observe(container)
    }
    if (observer && messageListEl) {
      observer.observe(messageListEl)
    }

    window.addEventListener('resize', updateAutoMaxInputHeight)
    return () => {
      window.removeEventListener('resize', updateAutoMaxInputHeight)
      observer?.disconnect()
    }
  }, [getMaxInputHeight])

  // Layout effect: clamp input height when chrome changes
  React.useLayoutEffect(() => {
    if (inputHeight === null) return
    const minH = getMinInputHeight()
    const maxH = Math.max(minH, getMaxInputHeight())
    setInputHeight((prev) => {
      if (prev === null) return prev
      if (prev >= minH && prev <= maxH) return prev
      return Math.min(Math.max(prev, minH), maxH)
    })
  }, [attachedImagesCount, selectedSkill, getMaxInputHeight, getMinInputHeight, inputHeight])

  // Layout effect: sync auto input height
  React.useLayoutEffect(() => {
    syncAutoInputHeight()
  }, [syncAutoInputHeight, documentNodes, selectedFiles, attachedImagesCount, selectedSkill])

  // ResizeObserver for container, image preview, and bottom toolbar
  React.useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => {
      if (inputHeight === null) {
        syncAutoInputHeight()
        return
      }

      const minH = getMinInputHeight()
      const maxH = Math.max(minH, getMaxInputHeight())
      setInputHeight((prev) => {
        if (prev === null) return prev
        return Math.min(Math.max(prev, minH), maxH)
      })
    })

    const container = containerRef.current
    const imagePreview = imagePreviewRef.current
    const bottomToolbar = bottomToolbarRef.current

    if (container) observer.observe(container)
    if (imagePreview) observer.observe(imagePreview)
    if (bottomToolbar) observer.observe(bottomToolbar)

    return () => {
      observer.disconnect()
    }
  }, [getMaxInputHeight, getMinInputHeight, inputHeight, syncAutoInputHeight])

  const handleDragStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const el = containerRef.current
      if (!el) return
      const minH = getMinInputHeight()
      dragRef.current = {
        startY: e.clientY,
        startH: el.offsetHeight,
        minH,
        maxH: Math.max(minH, getMaxInputHeight())
      }
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'
    },
    [getMaxInputHeight, getMinInputHeight]
  )

  return {
    rootRef,
    containerRef,
    imagePreviewRef,
    bottomToolbarRef,
    inputHeight,
    autoInputHeight,
    autoMaxInputHeight,
    handleDragStart
  }
}
