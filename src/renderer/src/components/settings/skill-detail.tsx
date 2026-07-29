import { useTranslation } from 'react-i18next'
import { X, Pencil, Trash2, Loader2, FileText, FileCode } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import type { ScanFileInfo } from '@renderer/stores/skills-store'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileIcon({ type }: { type: string }): React.JSX.Element {
  const codeExts = new Set(['.py', '.js', '.ts', '.sh', '.bash', '.ps1', '.bat', '.cmd', '.rb', '.pl'])
  if (type === '.md') return <FileText className="size-3.5 text-blue-500" />
  if (codeExts.has(type)) return <FileCode className="size-3.5 text-amber-500" />
  return <FileText className="size-3.5 text-muted-foreground" />
}

export interface SkillDetailProps {
  name: string
  content: string | null
  files: ScanFileInfo[]
  onEdit: () => void
  onDelete: () => void
  onBack: () => void
}

export function SkillDetail({
  name,
  content,
  files,
  onEdit,
  onDelete,
  onBack
}: SkillDetailProps): React.JSX.Element {
  const { t } = useTranslation('settings')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2 shrink-0">
        <Button variant="ghost" size="icon-sm" className="size-7" onClick={onBack}>
          <X className="size-3.5" />
        </Button>
        <h3 className="text-sm font-semibold flex-1 truncate">{name}</h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="size-7" onClick={onEdit}>
              <Pencil className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('skills.installed.edit')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('skills.installed.delete')}</TooltipContent>
        </Tooltip>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {content === null ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            {t('skills.installed.loading')}
          </div>
        ) : (
          <div>
            {files.length > 0 && (
              <div className="mb-4 space-y-1">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('skills.installed.files', {
                    count: files.length,
                    size: formatSize(files.reduce((s, f) => s + f.size, 0))
                  })}
                </h4>
                <div className="max-h-32 overflow-y-auto space-y-0">
                  {files.map((file) => (
                    <div
                      key={file.name}
                      className="flex items-center gap-2 text-xs px-1 py-0.5 rounded hover:bg-muted/50"
                    >
                      <FileIcon type={file.type} />
                      <span className="flex-1 truncate font-mono text-[11px]">{file.name}</span>
                      <span className="text-muted-foreground text-[10px] shrink-0">
                        {formatSize(file.size)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <pre className="whitespace-pre-wrap break-words text-xs font-mono leading-relaxed bg-muted/30 rounded-lg p-3">
              {content}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
