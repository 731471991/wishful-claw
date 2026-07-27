import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@renderer/lib/utils'
import { MONO_FONT } from '@renderer/lib/constants'
import { FileCode, Folder, Search, Clock, Bot } from 'lucide-react'
import { LazySyntaxHighlighter } from '../LazySyntaxHighlighter'
import { COMMAND_TOOL_NAMES } from './types'
import { formatStructuredInputValue } from './search-utils'
export function StructuredInput({
  name,
  input
}: {
  name: string
  input: Record<string, unknown>
}): React.JSX.Element {
  const { t } = useTranslation('chat')

  if (name === 'Skill') {
    const skillName = getSkillNameFromInput(input)
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted/20 px-3 py-2 text-xs">
        <span className="shrink-0 text-muted-foreground/65">{t('toolCall.skillName')}</span>
        <span className="min-w-0 truncate font-mono text-foreground/85">{skillName || '-'}</span>
      </div>
    )
  }

  if (COMMAND_TOOL_NAMES.has(name)) {
    const command =
      typeof input.command === 'string'
        ? input.command
        : typeof input.command_preview === 'string'
          ? input.command_preview
          : ''
    const description = input.description ? String(input.description) : null
    const timeout = input.timeout ? String(input.timeout) : null
    const commandChars = typeof input.command_chars === 'number' ? input.command_chars : null
    const commandLines = typeof input.command_lines === 'number' ? input.command_lines : null
    const commandTruncated = input.command_truncated === true
    return (
      <div className="space-y-0.5">
        <div className="flex items-start gap-1.5 text-xs">
          <span className="shrink-0 select-none pt-0.5 font-mono text-[11px] text-zinc-500">$</span>
          <span
            className="break-all font-mono text-[11px] text-sky-600 dark:text-sky-300"
            style={{ fontFamily: MONO_FONT }}
          >
            {command}
          </span>
        </div>
        {(description ||
          timeout ||
          commandChars !== null ||
          commandLines !== null ||
          commandTruncated) && (
          <div className="flex flex-wrap items-center gap-2 pl-[18px]">
            {description && <p className="text-[10px] text-muted-foreground/60">{description}</p>}
            {commandLines !== null && (
              <span className="text-[10px] text-muted-foreground/55">
                {t('toolCall.lineCount', { count: commandLines })}
              </span>
            )}
            {commandChars !== null && (
              <span className="text-[10px] text-muted-foreground/55">
                {t('toolCall.charCount', { count: commandChars })}
              </span>
            )}
            {commandTruncated && (
              <span className="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-600 dark:text-amber-300">
                {t('toolCall.preview')}
              </span>
            )}
            {timeout && (
              <span className="text-[10px] text-muted-foreground/55">
                {t('toolCall.timeoutMs', { value: timeout })}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  if (name === 'Read') {
    const filePath = String(input.file_path ?? input.path ?? '')
    const offset = input.offset != null ? String(input.offset) : null
    const limit = input.limit != null ? String(input.limit) : null
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 text-xs">
          <FileCode className="size-3 text-blue-400" />
          <span className="font-mono text-[11px] break-all" style={{ fontFamily: MONO_FONT }}>
            {filePath}
          </span>
        </div>
        {(offset || limit) && (
          <div className="flex items-center gap-2 pl-[18px]">
            {offset && (
              <span className="text-[10px] text-muted-foreground/55">offset: {offset}</span>
            )}
            {limit && <span className="text-[10px] text-muted-foreground/55">limit: {limit}</span>}
          </div>
        )}
      </div>
    )
  }

  if (name === 'Edit') {
    const filePath = String(input.file_path ?? input.path ?? '')
    const explanation = input.explanation ? String(input.explanation) : null
    const oldStr = typeof input.old_string === 'string' ? input.old_string : ''
    const newStr = typeof input.new_string === 'string' ? input.new_string : ''
    const oldPreview = typeof input.old_string_preview === 'string' ? input.old_string_preview : ''
    const newPreview = typeof input.new_string_preview === 'string' ? input.new_string_preview : ''
    const replaceAll = input.replace_all === true
    const visibleOld = oldStr || oldPreview
    const visibleNew = newStr || newPreview
    const oldTruncated = !oldStr && !!oldPreview
    const newTruncated = !newStr && !!newPreview
    const oldLineTotal =
      typeof input.old_string_lines === 'number'
        ? input.old_string_lines
        : visibleOld
          ? lineCount(visibleOld)
          : null
    const newLineTotal =
      typeof input.new_string_lines === 'number'
        ? input.new_string_lines
        : visibleNew
          ? lineCount(visibleNew)
          : null
    const oldCharTotal = typeof input.old_string_chars === 'number' ? input.old_string_chars : null
    const newCharTotal = typeof input.new_string_chars === 'number' ? input.new_string_chars : null

    return (
      <div className="space-y-1">
        {filePath && (
          <div className="flex items-center gap-1.5 text-xs">
            <FileCode className="size-3 text-amber-500 dark:text-amber-400" />
            <span className="font-mono text-[11px] break-all" style={{ fontFamily: MONO_FONT }}>
              {filePath}
            </span>
            {replaceAll && (
              <span className="rounded bg-amber-500/10 px-1 py-0.5 text-[9px] text-amber-600/80 dark:text-amber-400/80">
                replace_all
              </span>
            )}
          </div>
        )}
        {explanation && (
          <p className="pl-[18px] text-[11px] text-muted-foreground/60">{explanation}</p>
        )}
        {(oldLineTotal !== null ||
          newLineTotal !== null ||
          oldCharTotal !== null ||
          newCharTotal !== null) && (
          <div className="pl-[18px] text-[10px] text-muted-foreground/55">
            {t('toolCall.lineDelta', {
              old: oldLineTotal !== null ? oldLineTotal : '?',
              next: newLineTotal !== null ? newLineTotal : '?'
            })}
            {(oldCharTotal !== null || newCharTotal !== null) && (
              <>
                {' · '}
                {t('toolCall.charDelta', {
                  old: oldCharTotal !== null ? oldCharTotal : '?',
                  next: newCharTotal !== null ? newCharTotal : '?'
                })}
              </>
            )}
          </div>
        )}
        {(visibleOld || visibleNew) && (
          <div className="space-y-2 pl-[18px]">
            {visibleOld && (
              <EditPayloadPane
                label="old_string"
                value={visibleOld}
                language={detectLang(filePath)}
                tone="old"
                truncated={oldTruncated}
              />
            )}
            {visibleNew && (
              <EditPayloadPane
                label="new_string"
                value={visibleNew}
                language={detectLang(filePath)}
                tone="new"
                truncated={newTruncated}
              />
            )}
          </div>
        )}
      </div>
    )
  }

  if (name === 'Write') {
    const filePath = String(input.file_path ?? input.path ?? '')
    const content = typeof input.content === 'string' ? input.content : null
    const preview = typeof input.content_preview === 'string' ? input.content_preview : null
    const lineTotal =
      typeof input.content_lines === 'number'
        ? input.content_lines
        : content !== null
          ? lineCount(content)
          : null
    const charTotal =
      typeof input.content_chars === 'number'
        ? input.content_chars
        : content !== null
          ? content.length
          : null
    const visiblePreview = content ?? preview

    if (!content) {
      return (
        <div className="space-y-1">
          {filePath && (
            <div className="flex items-center gap-1.5 text-xs">
              <FileCode className="size-3 text-emerald-500 dark:text-green-400" />
              <span className="font-mono text-[11px] break-all" style={{ fontFamily: MONO_FONT }}>
                {filePath}
              </span>
            </div>
          )}
          {(lineTotal !== null || charTotal !== null) && (
            <div className="pl-[18px] text-[10px] text-muted-foreground/55">
              {lineTotal !== null ? t('toolCall.lineCount', { count: lineTotal }) : ''}
              {lineTotal !== null && charTotal !== null ? ' · ' : ''}
              {charTotal !== null ? t('toolCall.charCount', { count: charTotal }) : ''}
            </div>
          )}
          {visiblePreview && (
            <pre
              className="max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/70 bg-zinc-50 px-2.5 py-2 text-[11px] text-foreground/80 dark:bg-zinc-950 dark:text-zinc-300/80"
              style={{ fontFamily: MONO_FONT }}
            >
              {visiblePreview}
              {input.content_truncated ? '\n…' : ''}
            </pre>
          )}
        </div>
      )
    }
  }

  if (name === 'SavePlan') {
    const preview =
      (typeof input.content_preview === 'string' && input.content_preview) ||
      (typeof input.content === 'string' && input.content) ||
      ''
    if (!preview) return <></>
    return (
      <div className="space-y-1">
        <pre
          className="max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/70 bg-zinc-50 px-2.5 py-2 text-[11px] text-foreground/80 dark:bg-zinc-950 dark:text-zinc-300/80"
          style={{ fontFamily: MONO_FONT }}
        >
          {preview}
        </pre>
      </div>
    )
  }

  if (name === 'LS') {
    const path = String(input.path ?? '')
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <Folder className="size-3 text-amber-400" />
        <span className="font-mono text-[11px]" style={{ fontFamily: MONO_FONT }}>
          {path}
        </span>
      </div>
    )
  }

  if (name === 'Glob') {
    const pattern = String(input.pattern ?? '')
    const path = input.path ? String(input.path) : null
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="shrink-0 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
            {t('Glob')}
          </span>
          <span
            className="font-mono text-[11px] text-sky-600 dark:text-sky-300"
            style={{ fontFamily: MONO_FONT }}
          >
            {pattern}
          </span>
        </div>
        {path && (
          <div>
            <span className="text-[10px] text-zinc-500 font-mono" style={{ fontFamily: MONO_FONT }}>
              {path}
            </span>
          </div>
        )}
      </div>
    )
  }

  if (name === 'Grep') {
    const pattern = String(input.pattern ?? '')
    const path = input.path ? String(input.path) : null
    const include = input.include ? String(input.include) : null
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 text-xs">
          <Search className="size-3 text-amber-500 dark:text-amber-400" />
          <span
            className="font-mono text-[11px] text-amber-600/80 dark:text-amber-400/80"
            style={{ fontFamily: MONO_FONT }}
          >
            /{pattern}/
          </span>
        </div>
        {(path || include) && (
          <div className="flex items-center gap-2 pl-[18px]">
            {path && (
              <span
                className="text-[10px] text-muted-foreground/55 font-mono"
                style={{ fontFamily: MONO_FONT }}
              >
                {t('toolCall.searchInPath', { path })}
              </span>
            )}
            {include && (
              <span
                className="text-[10px] text-muted-foreground/55 font-mono"
                style={{ fontFamily: MONO_FONT }}
              >
                {t('toolCall.includeGlob', { include })}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  if (name === 'Task') {
    return (
      <div className="space-y-0.5">
        <InputField label="subagent_type" value={String(input.subagent_type ?? '')} />
        <InputField label="description" value={String(input.description ?? '')} />
        {input.prompt != null && (
          <InputField
            label="prompt"
            value={
              String(input.prompt).length > 200
                ? String(input.prompt).slice(0, 200) + '…'
                : String(input.prompt)
            }
          />
        )}
      </div>
    )
  }

  if (name === 'CronAdd') {
    const jobName = input.name ? String(input.name) : null
    const schedule = input.schedule as
      | { kind?: string; at?: string; every?: number; expr?: string; tz?: string }
      | undefined
    const prompt = input.prompt ? String(input.prompt) : null
    const deleteAfterRun = Boolean(input.deleteAfterRun)
    const agentId = input.agentId ? String(input.agentId) : null
    const kindLabels: Record<string, string> = { at: 'Once', every: 'Interval', cron: 'Cron' }
    const kindColors: Record<string, string> = {
      at: 'bg-amber-500/10 text-amber-400',
      every: 'bg-cyan-500/10 text-cyan-400',
      cron: 'bg-violet-500/10 text-violet-400'
    }
    const kind = schedule?.kind ?? 'cron'
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs">
          <Clock className="size-3 text-blue-400" />
          {schedule?.expr && (
            <span
              className="font-mono text-[11px] text-blue-400/80"
              style={{ fontFamily: MONO_FONT }}
            >
              {schedule.expr}
            </span>
          )}
          {schedule?.every && (
            <span
              className="font-mono text-[11px] text-cyan-400/80"
              style={{ fontFamily: MONO_FONT }}
            >
              every{' '}
              {schedule.every >= 3600000
                ? `${(schedule.every / 3600000).toFixed(1)}h`
                : `${Math.round(schedule.every / 60000)}m`}
            </span>
          )}
          {schedule?.at && (
            <span
              className="font-mono text-[11px] text-amber-400/80"
              style={{ fontFamily: MONO_FONT }}
            >
              {String(schedule.at).slice(0, 19)}
            </span>
          )}
          <span
            className={cn(
              'text-[9px] px-1 rounded',
              kindColors[kind] ?? 'bg-zinc-700/60 text-zinc-400'
            )}
          >
            {kindLabels[kind] ?? kind}
          </span>
          {deleteAfterRun && (
            <span className="text-[9px] px-1 rounded bg-amber-500/10 text-amber-400/80">
              auto-delete
            </span>
          )}
          {schedule?.tz && schedule.tz !== 'UTC' && (
            <span className="text-[9px] text-muted-foreground/55">{schedule.tz}</span>
          )}
        </div>
        {jobName && <p className="text-xs text-muted-foreground/60 italic pl-[18px]">{jobName}</p>}
        {prompt && (
          <div className="pl-[18px] flex items-center gap-1.5">
            <Bot className="size-2.5 text-violet-400" />
            <span className="text-[10px] text-violet-400/70 truncate max-w-[260px]">
              {prompt.slice(0, 100)}
            </span>
          </div>
        )}
        {agentId && agentId !== 'CronAgent' && (
          <div className="pl-[18px]">
            <span className="text-[9px] px-1 rounded bg-violet-500/10 text-violet-400">
              agent: {agentId}
            </span>
          </div>
        )}
      </div>
    )
  }

  if (name === 'CronUpdate') {
    const jobId = String(input.jobId ?? '')
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <Clock className="size-3 text-blue-400/70" />
        <span className="font-mono text-[11px] text-blue-400/70" style={{ fontFamily: MONO_FONT }}>
          {jobId}
        </span>
        <span className="text-[9px] text-muted-foreground/50">patch</span>
      </div>
    )
  }

  if (name === 'CronRemove') {
    const jobId = String(input.jobId ?? '')
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <Clock className="size-3 text-muted-foreground/50" />
        <span
          className="font-mono text-[11px] text-muted-foreground/70"
          style={{ fontFamily: MONO_FONT }}
        >
          {jobId}
        </span>
      </div>
    )
  }

  if (name === 'CronList') {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <Clock className="size-3 text-muted-foreground/50" />
        <span className="text-muted-foreground/60">list all scheduled cron jobs</span>
      </div>
    )
  }

  if (name === 'visualize_show_widget') {
    const payload = normalizeWidgetPayload(input)
    const messages = Array.isArray(input.loading_messages)
      ? input.loading_messages.filter((item): item is string => typeof item === 'string')
      : []
    return (
      <div className="space-y-0.5">
        <InputField label="title" value={payload?.title ?? String(input.title ?? '')} />
        <InputField label="kind" value={payload?.kind ?? 'html'} />
        {messages.length > 0 && <InputField label="loading" value={messages.join(' / ')} />}
      </div>
    )
  }

  if (name === 'memory_hot_read') {
    const scope = input.scope ? String(input.scope) : null
    return (
      <div className="space-y-0.5">
        {scope && <InputField label="scope" value={scope} />}
      </div>
    )
  }

  if (name === 'memory_hot_write') {
    const section = String(input.section ?? '')
    const contentVal = typeof input.content === 'string' ? input.content : ''
    return (
      <div className="space-y-1">
        <InputField label="section" value={section} mono />
        {contentVal && (
          <pre
            className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/70 bg-muted/20 px-2.5 py-2 text-[11px] text-foreground/80 dark:bg-zinc-950 dark:text-zinc-300/80"
            style={{ fontFamily: MONO_FONT }}
          >
            {contentVal.length > 300 ? contentVal.slice(0, 300) + '…' : contentVal}
          </pre>
        )}
      </div>
    )
  }

  if (name === 'memory_search') {
    const query = String(input.query ?? '')
    const scope = input.scope ? String(input.scope) : null
    const includeDeprecated = input.include_deprecated === true
    return (
      <div className="space-y-0.5">
        <InputField label="query" value={query} mono />
        {includeDeprecated && <InputField label="include_deprecated" value="true" />}
        {scope && <InputField label="scope" value={scope} />}
      </div>
    )
  }

  if (name === 'memory_append') {
    const priority = String(input.priority ?? 'standard')
    const title = input.title ? String(input.title) : null
    const contentVal = typeof input.content === 'string' ? input.content : ''
    return (
      <div className="space-y-1">
        <InputField label="priority" value={priority} />
        {title && <InputField label="title" value={title} />}
        {contentVal && (
          <pre
            className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/70 bg-muted/20 px-2.5 py-2 text-[11px] text-foreground/80 dark:bg-zinc-950 dark:text-zinc-300/80"
            style={{ fontFamily: MONO_FONT }}
          >
            {contentVal.length > 300 ? contentVal.slice(0, 300) + '…' : contentVal}
          </pre>
        )}
      </div>
    )
  }

  if (name === 'memory_update') {
    const id = String(input.id ?? '')
    const status = input.status ? String(input.status) : null
    const priority = input.priority ? String(input.priority) : null
    const contentVal = typeof input.content === 'string' ? input.content : ''
    return (
      <div className="space-y-1">
        <InputField label="id" value={id} />
        {status && <InputField label="status" value={status} />}
        {priority && <InputField label="priority" value={priority} />}
        {contentVal && (
          <pre
            className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/70 bg-muted/20 px-2.5 py-2 text-[11px] text-foreground/80 dark:bg-zinc-950 dark:text-zinc-300/80"
            style={{ fontFamily: MONO_FONT }}
          >
            {contentVal.length > 300 ? contentVal.slice(0, 300) + '…' : contentVal}
          </pre>
        )}
      </div>
    )
  }

  const entries = Object.entries(input).filter(([, v]) => v != null && v !== '')
  if (entries.length === 0) return <></>
  return (
    <div className="space-y-0.5">
      {entries.map(([key, value]) => {
        const formatted = formatStructuredInputValue(value)
        return <InputField key={key} label={key} value={formatted.text} mono={formatted.mono} />
      })}
    </div>
  )
}
