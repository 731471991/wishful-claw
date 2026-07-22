import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Eraser, MoreHorizontal } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { MessageList } from '@renderer/components/chat/MessageList'
import { InputArea } from '@renderer/components/chat/InputArea'
import { useChatStore } from '@renderer/stores/chat-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { useChatActions } from '@renderer/hooks/use-chat-actions'
import { ActivityPanel } from '@renderer/components/activity/ActivityPanel'
import { useActivityStore } from '@renderer/stores/activity-store'
import { toast } from 'sonner'

interface SessionConversationPaneProps {
  sessionId?: string | null
}

export function SessionConversationPane({
  sessionId
}: SessionConversationPaneProps): React.JSX.Element {
  const { t } = useTranslation('layout')
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const resolvedSessionId = sessionId ?? activeSessionId
  const session = useChatStore((s) =>
    s.sessions.find((sess) => sess.id === resolvedSessionId)
  )
  const clearSessionMessages = useChatStore((s) => s.clearSessionMessages)
  const deleteSession = useChatStore((s) => s.deleteSession)
  const { sendMessage, stopStreaming } = useChatActions()
  const isStreaming = useChatStore((s) =>
    resolvedSessionId ? Boolean(s.streamingMessages[resolvedSessionId]) : false
  )
  const activities = useActivityStore((s) => s.activities)

  const handleSend = useCallback(
    (text: string, _images?: unknown, _options?: unknown) => {
      if (!resolvedSessionId) return
      void sendMessage(text, undefined, undefined, resolvedSessionId)
    },
    [resolvedSessionId, sendMessage]
  )

  const handleClear = useCallback(() => {
    if (!resolvedSessionId) return
    if (session && session.messageCount > 0) {
      clearSessionMessages(resolvedSessionId)
      toast.success(t('layout.conversationCleared', { defaultValue: 'Conversation cleared' }))
    }
  }, [resolvedSessionId, session, clearSessionMessages, t])

  const handleDelete = useCallback(() => {
    if (!resolvedSessionId) return
    deleteSession(resolvedSessionId)
    useUIStore.getState().navigateToHome()
  }, [resolvedSessionId, deleteSession])

  if (!session) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p className="text-sm">{t('layout.noSessionSelected', { defaultValue: 'No session selected' })}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      {/* Left: Chat area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Session header */}
        <div className="flex h-9 shrink-0 items-center justify-between border-b px-3">
          <div className="truncate text-xs font-medium text-foreground/80">
            {session.title}
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleClear}
                  className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Eraser className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('sidebar.clearMessages', { defaultValue: 'Clear messages' })}</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                  <MoreHorizontal className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleClear}>
                  <Eraser className="mr-2 size-3.5" />
                  {t('sidebar.clearMessages', { defaultValue: 'Clear messages' })}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  {t('sidebar.deleteSession', { defaultValue: 'Delete session' })}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Messages */}
        <div className="flex flex-1 min-h-0">
          <MessageList />
        </div>

        {/* Input */}
        <InputArea
          onSend={handleSend}
          isStreaming={isStreaming}
          onStop={stopStreaming}
          sessionId={resolvedSessionId ?? undefined}
        />
      </div>

      {/* Right: Activity panel (only show if activities exist) */}
      {activities.length > 0 && (
        <div className="w-72 shrink-0 border-l">
          <ActivityPanel />
        </div>
      )}
    </div>
  )
}
