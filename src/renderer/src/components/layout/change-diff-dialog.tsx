import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { CodeDiffViewer } from '@renderer/components/chat/CodeDiffViewer'
import { useUIStore } from '@renderer/stores/ui-store'
import {
  isLoadedChangeContent, loadAggregatedChangeContent
} from '@renderer/components/chat/change-summary-utils'
import {
  computeDiff, detectLang, fileName, foldContext, snapshotText,
  type AggregatedFileChange, type DiffChunk
} from '@renderer/components/chat/file-change-utils'
import type { ChangeRow, GitChangeRow } from './agent-files-types'
import { dirname, gitDiffKey, repoRelativePath } from './agent-files-utils'

export function ChangeDiffDialog({
  open,
  rows,
  selectedKey,
  repoPath,
  diffByKey,
  onOpenChange,
  onSelect,
  onLoadGitDiff
}: {
  open: boolean
  rows: ChangeRow[]
  selectedKey: string | null
  repoPath: string | null
  diffByKey: Record<string, string>
  onOpenChange: (open: boolean) => void
  onSelect: (key: string) => void
  onLoadGitDiff: (row: GitChangeRow) => Promise<string>
}): React.JSX.Element {
  const { t } = useTranslation('layout')
  const openFilePreview = useUIStore((state) => state.openFilePreview)
  const [fullscreen, setFullscreen] = React.useState(false)
  const [chunks, setChunks] = React.useState<DiffChunk[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const selectedIndex = Math.max(
    0,
    rows.findIndex((row) => row.key === selectedKey)
  )
  const selected = rows[selectedIndex] ?? rows[0] ?? null

  React.useEffect(() => {
    if (!open || !selected) {
      setChunks([])
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    const load = async (): Promise<void> => {
      setLoading(true)
      setError(null)
      try {
        if (selected.source === 'agent') {
          const loaded = await loadAggregatedChangeContent(selected.change)
          if (cancelled) return
          if (!isLoadedChangeContent(loaded)) {
            const beforeText =
              selected.change.op === 'modify' ? snapshotText(selected.change.before) : ''
            const afterText = snapshotText(selected.change.after)
            setChunks(foldContext(computeDiff(beforeText, afterText)))
            return
          }
          setChunks(foldContext(computeDiff(loaded.beforeText, loaded.afterText)))
          return
        }

        if (selected.section === 'untracked') {
          setChunks([
            {
              type: 'lines',
              lines: [
                {
                  type: 'keep',
                  text: t('agentFiles.untrackedNoDiff', {
                    defaultValue: 'Untracked files do not have a diff until they are staged.'
                  })
                }
              ]
            }
          ])
          return
        }

        const diffText = diffByKey[gitDiffKey(selected)] ?? (await onLoadGitDiff(selected))
        if (cancelled) return
        setChunks(parseUnifiedDiff(diffText))
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [diffByKey, onLoadGitDiff, open, selected, t])

  const go = (delta: number): void => {
    if (rows.length === 0) return
    const next = rows[(selectedIndex + delta + rows.length) % rows.length]
    if (next) onSelect(next.key)
  }

  const resolvedFilePath =
    selected?.source === 'git' && repoPath
      ? joinPath(repoPath, selected.filePath)
      : selected?.filePath

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'agent-files-diff-dialog grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0',
          fullscreen
            ? 'h-[92vh] w-[96vw] max-w-[96vw] sm:max-w-[96vw]'
            : 'h-[72vh] w-[92vw] max-w-[1100px] sm:max-w-[1100px]'
        )}
      >
        <div className="flex h-9 items-center gap-2 border-b border-agent-files-border bg-agent-files-panel px-2">
          <FileCode className="size-4 shrink-0 text-agent-files-icon" />
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-agent-files-fg">
            {selected?.filePath ?? t('agentFiles.diff', { defaultValue: 'Diff' })}
          </span>
          <span className="rounded bg-agent-files-hover px-1.5 py-0.5 text-[11px] text-agent-files-muted">
            {rows.length > 0 ? `${selectedIndex + 1} of ${rows.length}` : '0'}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            className="agent-files-icon-button"
            onClick={() => go(-1)}
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            className="agent-files-icon-button"
            onClick={() => go(1)}
          >
            <ChevronRight className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            className="agent-files-icon-button"
            disabled={!resolvedFilePath}
            onClick={() => resolvedFilePath && openFilePreview(resolvedFilePath)}
            title={t('agentFiles.openFile', { defaultValue: 'Open file' })}
          >
            <ExternalLink className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            className="agent-files-icon-button"
            onClick={() => setFullscreen((value) => !value)}
          >
            {fullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            className="agent-files-icon-button"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-3.5" />
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)] bg-agent-files-panel">
          <div className="min-h-0 overflow-y-auto border-r border-agent-files-border py-1">
            <div className="px-3 py-1 text-[11px] font-semibold text-agent-files-muted">
              {t('agentFiles.changes', { defaultValue: 'Changes' })}
            </div>
            {rows.map((row) => (
              <ChangeItemRow
                key={row.key}
                row={row}
                selected={row.key === selected?.key}
                onSelect={() => onSelect(row.key)}
                showActions={false}
              />
            ))}
          </div>
          <div className="flex min-h-0 flex-col overflow-hidden p-3">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-agent-files-muted">
                <Loader2 className="mr-2 size-4 animate-spin" />
                {t('agentFiles.loadingDiff', { defaultValue: 'Loading diff...' })}
              </div>
            ) : error ? (
              <div className="rounded border border-destructive/40 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : chunks.length === 0 ? (
              <AgentFilesEmptyState
                title={t('agentFiles.noDiff', { defaultValue: 'No diff available' })}
                description={t('agentFiles.noDiffDesc', {
                  defaultValue: 'This file has no renderable text diff.'
                })}
              />
            ) : (
              <CodeDiffViewer
                chunks={chunks}
                defaultMode="inline"
                showModeToggle
                toolbarEnd={null}
                fillHeight
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

