import * as React from 'react'
import { ChevronDown, ChevronUp, FileCode2, LocateFixed, Trash2, X } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { cn } from '@renderer/lib/utils'
import type { SelectedFileItem } from '@renderer/lib/select-file-editor'

interface SelectedFileBarProps {
  files: SelectedFileItem[]
  highlightedFileId?: string | null
  onPreview: (file: SelectedFileItem) => void
  onLocate: (fileId: string) => void
  onRemove: (fileId: string) => void
  onClear: () => void
}

const COLLAPSED_VISIBLE_COUNT = 3

export function SelectedFileBar({
  files,
  highlightedFileId,
  onPreview,
  onLocate,
  onRemove,
  onClear
}: SelectedFileBarProps): React.JSX.Element | null {
  const [expanded, setExpanded] = React.useState(false)

  React.useEffect(() => {
    if (files.length <= COLLAPSED_VISIBLE_COUNT) {
      setExpanded(false)
    }
  }, [files.length])

  if (files.length === 0) return null

  const collapsed = files.length > COLLAPSED_VISIBLE_COUNT && !expanded
  const visibleFiles = collapsed ? files.slice(0, COLLAPSED_VISIBLE_COUNT) : files
  const hiddenCount = Math.max(0, files.length - visibleFiles.length)

  return (
    <div className="px-1 pb-2">
      <div className="overflow-hidden rounded-lg border border-border/60 bg-muted/20">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-2.5 py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/70">
              <FileCode2 className="size-3.5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-foreground">Selected files</div>
              <div className="truncate text-[10px] text-muted-foreground">
                Drag into input to display as inline file component
              </div>
            </div>
            <span className="rounded-md border border-border/60 bg-background/70 px-1.5 py-0.5 text-[10px] text-muted-foreground tabular-nums">
              {files.length}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {files.length > COLLAPSED_VISIBLE_COUNT && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 gap-1 rounded-md px-1.5 text-[10px]"
                onClick={() => setExpanded((prev) => !prev)}
              >
                {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                {expanded ? 'Collapse' : `More ${hiddenCount}`}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 rounded-md px-1.5 text-[10px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={onClear}
            >
              <Trash2 className="size-3" />
              Clear
            </Button>
          </div>
        </div>

        <div className="grid gap-1 p-1.5">
          {visibleFiles.map((file) => {
            const isHighlighted = highlightedFileId === file.id
            return (
              <div
                key={file.id}
                id={`selected-file-bar-item-${file.id}`}
                className={cn(
                  'group/file-item flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors',
                  isHighlighted
                    ? 'border-primary/35 bg-primary/10 ring-2 ring-primary/15'
                    : 'border-border/50 bg-background/55 hover:border-border hover:bg-background/80'
                )}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => onPreview(file)}
                  title={file.previewPath}
                >
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/35 text-muted-foreground">
                    <FileCode2 className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-foreground">{file.name}</div>
                    <div className="truncate font-mono text-[10px] text-muted-foreground">
                      {file.sendPath}
                    </div>
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        onClick={() => onLocate(file.id)}
                      >
                        <LocateFixed className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Locate reference</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onRemove(file.id)}
                      >
                        <X className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Remove file</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
