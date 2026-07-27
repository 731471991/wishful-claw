// Utility functions and helpers for PreviewPanel

import type React from 'react'
import { Bot, File, FileDiff, Globe } from 'lucide-react'
import type { PreviewPanelTab } from '@renderer/stores/preview-panel-helpers'

export function fileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath
}

export function relativePath(filePath: string, workingFolder?: string | null): string {
  if (!workingFolder) return filePath
  const normalizedFile = filePath.replace(/\\/g, '/')
  const normalizedFolder = workingFolder.replace(/\\/g, '/').replace(/\/+$/, '')
  if (!normalizedFile.toLowerCase().startsWith(`${normalizedFolder.toLowerCase()}/`)) {
    return filePath
  }
  return normalizedFile.slice(normalizedFolder.length + 1)
}

export function breadcrumbParts(filePath: string, workingFolder?: string | null): string[] {
  return relativePath(filePath, workingFolder)
    .split(/[\\/]+/)
    .filter(Boolean)
}

export function fileExtension(filePath: string): string {
  const dot = filePath.lastIndexOf('.')
  return dot >= 0 ? filePath.slice(dot).toLowerCase() : ''
}

export function isExternalUrl(value: string): boolean {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(value)
}

export function shouldReadPreviewText(tab: PreviewPanelTab | null): boolean {
  if (!tab || tab.source !== 'file') return false
  if (tab.viewerType === 'html' || tab.viewerType === 'svg' || tab.viewerType === 'markdown') {
    return true
  }
  if (tab.viewerType === 'spreadsheet') {
    const ext = fileExtension(tab.filePath)
    return ext === '.csv' || ext === '.tsv'
  }
  return tab.viewerType === 'fallback'
}

export function tabTitle(tab: PreviewPanelTab): string {
  if (tab.source === 'markdown') return tab.markdownTitle || tab.title
  if (tab.source === 'dev-server') return tab.title
  return fileName(tab.filePath)
}

export function tabPathTitle(tab: PreviewPanelTab): string {
  if (tab.source === 'markdown') return tab.markdownTitle || tab.title
  if (tab.source === 'dev-server') return tab.projectDir || tab.title
  return tab.filePath
}

export function TabIcon({ tab }: { tab: PreviewPanelTab }): React.JSX.Element {
  if (tab.source === 'markdown') return <Bot className="size-3.5 text-violet-500" />
  if (tab.source === 'dev-server') return <Globe className="size-3.5 text-sky-500" />
  if (tab.source === 'diff') return <FileDiff className="size-3.5 text-amber-500" />
  return <File className="size-3.5 text-muted-foreground" />
}
