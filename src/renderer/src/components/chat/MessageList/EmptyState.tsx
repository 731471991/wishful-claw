import * as React from 'react'
import { getMessageColumnClass, getMessageColumnCompactClass } from './utils'
import { modeHints } from './mode-hints'

interface MessageListEmptyStateProps {
  fullWidth: boolean
  activeProjectId: string | null
  activeProjectName: string | null
  activeWorkingFolder: string | null
  isAwaitingInitialMessages: boolean
  mode: string
  t: (key: string, options?: Record<string, unknown>) => string
  applySuggestedPrompt: (prompt: string) => void
}

export function MessageListEmptyState(props: MessageListEmptyStateProps): React.JSX.Element | null {
  const {
    fullWidth,
    activeProjectId,
    activeProjectName,
    activeWorkingFolder,
    isAwaitingInitialMessages,
    mode,
    t,
    applySuggestedPrompt
  } = props

  if (isAwaitingInitialMessages) {
    return (
      <div className="flex h-full flex-1 flex-col gap-4 overflow-hidden px-4 pt-6">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className={`${getMessageColumnClass(fullWidth)} space-y-2 ${
              index % 2 === 0 ? 'self-start' : 'self-end'
            }`}
          >
            <div className="h-3 w-3/5 animate-pulse rounded-md bg-muted/50" />
            <div className="h-3 w-4/5 animate-pulse rounded-md bg-muted/40" />
            <div className="h-3 w-1/2 animate-pulse rounded-md bg-muted/30" />
          </div>
        ))}
      </div>
    )
  }

  // messages.length === 0 case
  const hint = modeHints[mode]
  const projectScoped = Boolean(activeProjectId)
  const emptyTitle = projectScoped
    ? `What should we build in ${activeProjectName ?? 'this project'}?`
    : mode === 'chat'
      ? 'What should we talk through?'
      : t(hint.titleKey)
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center px-6 text-center">
      <div
        className={`flex flex-col items-center gap-3 ${getMessageColumnCompactClass(fullWidth)}`}
      >
        <div>
          <p className="text-[18px] font-semibold tracking-tight text-foreground/92 sm:text-[19px]">
            {emptyTitle}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground/70 sm:text-[14px]">
            {projectScoped ? t('messageList.startCodingDesc') : t(hint.descKey)}
          </p>
        </div>
      </div>

      <div className="mt-6 flex max-w-[520px] flex-wrap justify-center gap-2">
        {(mode === 'chat'
          ? [
              t('messageList.explainAsync'),
              t('messageList.compareRest'),
              t('messageList.writeRegex')
            ]
          : activeWorkingFolder
            ? [
                t('messageList.summarizeProject'),
                t('messageList.findBugs'),
                t('messageList.addErrorHandling')
              ]
            : [
                t('messageList.reviewCodebase'),
                t('messageList.addTests'),
                t('messageList.refactorError')
              ]
        ).map((prompt) => (
          <button
            key={prompt}
            className="rounded-md border border-border/60 bg-background/50 px-3 py-1.5 text-[11px] text-muted-foreground/70 transition-colors hover:bg-muted/50 hover:text-foreground"
            onClick={() => applySuggestedPrompt(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}
