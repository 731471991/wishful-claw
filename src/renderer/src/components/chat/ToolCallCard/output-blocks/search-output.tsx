import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Folder, FolderTree, File } from 'lucide-react'
import { MONO_FONT } from '@renderer/lib/constants'
import {
  parseGrepOutput,
  parseGlobOutput,
  parseLsEntries,
  getSearchVisualState,
  formatSearchEngineLabel
} from '../utils'
import {
  CopyBtn,
  HighlightText,
  SearchStateBadge,
  SearchEmptyState,
  SearchMetaHint
} from '../shared'
import { OutputBlock } from './text-output'
import { useUIStore } from '@renderer/stores/ui-store'

export function GrepOutputBlock({
  output,
  pattern
}: {
  output: string
  pattern?: string
}): React.JSX.Element {
  const { t } = useTranslation('chat')
  const parsed = React.useMemo(() => parseGrepOutput(output), [output])

  const groups = React.useMemo(() => {
    if (!parsed) return []
    const map = new Map<
      string,
      Array<{ line?: number; column?: number; text: string; count?: number }>
    >()
    for (const r of parsed.matches) {
      const list = map.get(r.file) ?? []
      list.push({ line: r.line, column: r.column, text: r.text, count: r.count })
      map.set(r.file, list)
    }
    return Array.from(map.entries())
  }, [parsed])

  if (!parsed) return <OutputBlock output={output} />
  if (parsed.matches.length === 0 && parsed.meta.error) return <OutputBlock output={output} />
  if (parsed.matches.length === 0 && parsed.output?.trim()) {
    return <OutputBlock output={parsed.output} />
  }

  const matchCount = parsed.matches.length
  const visualState = getSearchVisualState(parsed.meta, matchCount)
  const engineLabel = formatSearchEngineLabel(parsed.meta.engine)
  const copyText = output

  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <Search className="size-3 text-amber-500 dark:text-amber-400" />
        <p className="text-xs font-medium text-muted-foreground">{t('toolCall.grepResults')}</p>
        <SearchStateBadge state={visualState} />
        {engineLabel && (
          <span className="rounded border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[9px] text-muted-foreground">
            {engineLabel}
          </span>
        )}
        {pattern && (
          <span className="text-[9px] font-mono text-amber-600/70 dark:text-amber-400/50">
            /{pattern}/
          </span>
        )}
        <span className="text-[9px] text-muted-foreground/55">
          {t('toolCall.matchesInFiles', { matches: matchCount, files: groups.length })}
        </span>
        <CopyBtn text={copyText} />
      </div>
      <SearchMetaHint meta={parsed.meta} />
      {groups.length === 0 ? (
        <SearchEmptyState />
      ) : (
        <div
          className="max-h-72 overflow-auto rounded-md border border-border/70 bg-zinc-50 text-[11px] font-mono divide-y divide-border/70 dark:bg-zinc-950 dark:divide-zinc-800"
          style={{ fontFamily: MONO_FONT }}
        >
          {groups.map(([file, matches]) => (
            <div key={file} className="px-2 py-1.5">
              <div
                className="text-sky-600 truncate mb-0.5 cursor-pointer hover:text-sky-700 transition-colors dark:text-blue-400/70 dark:hover:text-blue-300"
                title={t('toolCall.clickToInsert', { path: file })}
                onClick={() => {
                  const short = file.split(/[\\/]/).slice(-2).join('/')
                  import('@renderer/stores/ui-store').then(({ useUIStore }) =>
                    useUIStore.getState().setPendingInsertText(short)
                  )
                }}
              >
                {file.split(/[\\/]/).slice(-3).join('/')}
              </div>
              {matches.map((m, i) => (
                <div key={i} className="flex gap-2 text-foreground/70 dark:text-zinc-400">
                  <span className="w-12 shrink-0 select-none text-right text-muted-foreground/70 dark:text-zinc-600">
                    {typeof m.count === 'number'
                      ? m.count
                      : typeof m.line === 'number'
                        ? m.column
                          ? `${m.line}:${m.column}`
                          : m.line
                        : ''}
                  </span>
                  <span className="truncate">
                    {m.text ? <HighlightText text={m.text} pattern={pattern} /> : null}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function GlobOutputBlock({ output }: { output: string }): React.JSX.Element {
  const { t } = useTranslation('chat')
  const maxVisibleItems = 200
  const parsed = React.useMemo(() => parseGlobOutput(output), [output])
  if (!parsed) return <OutputBlock output={output} />
  if (parsed.matches.length === 0 && parsed.meta.error) return <OutputBlock output={output} />
  const visibleItems = parsed.matches.slice(0, maxVisibleItems)
  const hiddenCount = Math.max(0, parsed.matches.length - visibleItems.length)
  const visualState = getSearchVisualState(parsed.meta, parsed.matches.length)

  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
          {t('Glob')}
        </span>
        <SearchStateBadge state={visualState} />
        <span className="text-[9px] text-muted-foreground">
          {t('toolCall.pathCount', { count: parsed.matches.length })}
        </span>
        <CopyBtn text={parsed.matches.join('\n')} />
      </div>
      <SearchMetaHint meta={parsed.meta} />
      {visibleItems.length === 0 ? (
        <SearchEmptyState />
      ) : (
        <div
          className="max-h-48 space-y-0.5 overflow-auto rounded-xl border border-border/70 bg-zinc-50 px-3 py-2 text-[11px] font-mono text-zinc-700 dark:border-white/[0.06] dark:bg-[#111214] dark:text-zinc-400"
          style={{ fontFamily: MONO_FONT }}
        >
          {visibleItems.map((p, i) => (
            <div
              key={i}
              className="truncate cursor-pointer text-sky-600 transition-colors hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-200"
              title={t('toolCall.clickToInsert', { path: p })}
              onClick={() => {
                const short = p.split(/[\\/]/).slice(-2).join('/')
                import('@renderer/stores/ui-store').then(({ useUIStore }) =>
                  useUIStore.getState().setPendingInsertText(short)
                )
              }}
            >
              {p}
            </div>
          ))}
          {hiddenCount > 0 && (
            <div className="pt-1 text-[10px] text-muted-foreground">
              {t('toolCall.moreResultsHidden', { shown: visibleItems.length, hidden: hiddenCount })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function LSOutputBlock({ output }: { output: string }): React.JSX.Element {
  const { t } = useTranslation('chat')
  const parsed = React.useMemo(() => parseLsEntries(output), [output])
  if (!parsed || !Array.isArray(parsed)) return <OutputBlock output={output} />

  const dirs = parsed.filter((e) => e.type === 'directory')
  const files = parsed.filter((e) => e.type === 'file')

  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <FolderTree className="size-3 text-amber-500 dark:text-amber-400" />
        <p className="text-xs font-medium text-muted-foreground">
          {t('toolCall.directoryListing')}
        </p>
        <span className="text-[9px] text-muted-foreground/55">
          {t('toolCall.foldersAndFiles', { folders: dirs.length, files: files.length })}
        </span>
        <CopyBtn text={parsed.map((e) => e.name).join('\n')} />
      </div>
      <div
        className="max-h-48 overflow-auto rounded-md border border-border/70 bg-zinc-50 px-3 py-2 text-[11px] font-mono space-y-0.5 dark:bg-zinc-950"
        style={{ fontFamily: MONO_FONT }}
      >
        {dirs.map((e) => (
          <div
            key={e.name}
            className="flex items-center gap-1.5 text-amber-600/80 dark:text-amber-400/70"
          >
            <Folder className="size-3 shrink-0" />
            <span>{e.name}/</span>
          </div>
        ))}
        {files.map((e) => (
          <div
            key={e.name}
            className="flex cursor-pointer items-center gap-1.5 text-foreground/70 transition-colors hover:text-sky-600 dark:text-zinc-400 dark:hover:text-blue-400"
            title={t('toolCall.clickToInsert', { path: e.path || e.name })}
            onClick={() => {
              const short = (e.path || e.name).split(/[\\/]/).slice(-2).join('/')
              import('@renderer/stores/ui-store').then(({ useUIStore }) =>
                useUIStore.getState().setPendingInsertText(short)
              )
            }}
          >
            <File className="size-3 shrink-0 text-zinc-500" />
            <span>{e.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
