// Toolbar for PreviewPanel

import { useTranslation } from 'react-i18next'
import {
  Bot, Check, Code2, Columns2, Copy, ExternalLink, Eye,
  RefreshCw, Rows2, Save
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import type { PreviewPanelTab } from '@renderer/stores/preview-panel-helpers'
import { cn } from '@renderer/lib/utils'

interface PreviewToolbarProps {
  activeTab: PreviewPanelTab
  fileDisplayName: string
  breadcrumbs: string[]
  isMarkdown: boolean
  isDiff: boolean
  canToggleViewMode: boolean
  canOpenInSystem: boolean
  diffViewMode: string
  copied: boolean
  onSetViewMode: (mode: 'preview' | 'code') => void
  onCopyMarkdown: () => void
  onSetDiffViewMode: (mode: 'split' | 'inline') => void
  onSave: () => void
  onReload: () => void
  onOpenInSystem: () => void
}

export function PreviewToolbar({
  activeTab, fileDisplayName, breadcrumbs, isMarkdown, isDiff,
  canToggleViewMode, canOpenInSystem, diffViewMode, copied,
  onSetViewMode, onCopyMarkdown, onSetDiffViewMode, onSave, onReload, onOpenInSystem
}: PreviewToolbarProps): React.JSX.Element {
  const { t } = useTranslation('layout')
  return (
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/40 bg-muted/20 px-3">
        <div className="flex min-w-0 flex-1 items-center gap-1 text-[11px] text-muted-foreground">
          {isMarkdown ? (
            <>
              <Bot className="size-3.5 shrink-0 text-violet-500" />
              <span className="truncate text-foreground">{fileDisplayName}</span>
            </>
          ) : breadcrumbs.length > 0 ? (
            breadcrumbs.map((part, index) => (
              <span key={`${part}-${index}`} className="flex min-w-0 items-center gap-1">
                {index > 0 && <span className="text-muted-foreground/50">/</span>}
                <span
                  className={cn(
                    'truncate',
                    index === breadcrumbs.length - 1 && 'font-medium text-foreground'
                  )}
                >
                  {part}
                </span>
              </span>
            ))
          ) : (
            <span className="truncate text-foreground">{fileDisplayName}</span>
          )}
        </div>

        {canToggleViewMode && (
          <div className="flex shrink-0 items-center rounded-md border border-border/60 bg-background p-0.5">
            <Button
              variant={activeTab.viewMode === 'preview' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-5 gap-1 px-2 text-[10px]"
              onClick={() => onSetViewMode('preview')}
            >
              <Eye className="size-3" />
              {t('preview.preview')}
            </Button>
            <Button
              variant={activeTab.viewMode === 'code' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-5 gap-1 px-2 text-[10px]"
              onClick={() => onSetViewMode('code')}
            >
              <Code2 className="size-3" />
              {t('preview.code')}
            </Button>
          </div>
        )}

        {isMarkdown && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={handleCopyMarkdown}
            title={copied ? t('preview.copied') : t('action.copy', { ns: 'common' })}
          >
            {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
          </Button>
        )}

        {isDiff && (
          <div className="flex shrink-0 items-center rounded-md border border-border/60 bg-background p-0.5">
            <Button
              variant={diffViewMode !== 'inline' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-5 gap-1 px-2 text-[10px]"
              onClick={() => updateSettings({ fileDiffViewMode: 'split' })}
              title={t('preview.diffSplit', { defaultValue: 'Split' })}
            >
              <Columns2 className="size-3" />
            </Button>
            <Button
              variant={diffViewMode === 'inline' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-5 gap-1 px-2 text-[10px]"
              onClick={() => updateSettings({ fileDiffViewMode: 'inline' })}
              title={t('preview.diffInline', { defaultValue: 'Inline' })}
            >
              <Rows2 className="size-3" />
            </Button>
          </div>
        )}

        {isDiff && activeTab.diffModifiedEditable && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => void handleSave()}
            disabled={!activeTab.modified}
            title={t('action.save', { ns: 'common' })}
          >
            <Save className="size-3.5" />
          </Button>
        )}

        {activeTab.source === 'file' && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={() => void handleSave()}
              disabled={!activeTab.modified}
              title={t('action.save', { ns: 'common' })}
            >
              <Save className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={onReload}
              title={t('action.refresh', { ns: 'common', defaultValue: 'Refresh' })}
            >
              <RefreshCw className="size-3.5" />
            </Button>
          </>
        )}

        {canOpenInSystem && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => void handleOpenInSystem()}
            title={t('preview.openInSystem')}
          >
            <ExternalLink className="size-3.5" />
          </Button>
        )}
      </div>
  )
}
