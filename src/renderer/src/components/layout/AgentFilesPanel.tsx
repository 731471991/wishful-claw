import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { FileTreePanel } from '@renderer/components/cowork/FileTreePanel'
import { useChatStore } from '@renderer/stores/chat-store'
import { FileCode } from 'lucide-react'

export interface AgentFilesPanelProps {
  sessionId?: string | null
}

export function AgentFilesPanel(props: AgentFilesPanelProps) {
  const { t } = useTranslation('layout')

  const sessionView = useChatStore((state) => {
    const resolvedSessionId = props.sessionId ?? state.activeSessionId
    const currentSession = resolvedSessionId
      ? state.sessions.find((item) => item.id === resolvedSessionId)
      : undefined
    const currentProject = currentSession?.projectId
      ? state.projects.find((item) => item.id === currentSession.projectId)
      : undefined
    return {
      sessionId: resolvedSessionId,
      workingFolder: currentSession?.workingFolder ?? currentProject?.workingFolder ?? null
    }
  })

  if (!sessionView.workingFolder) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center text-xs text-muted-foreground">
        <FileCode className="size-8 opacity-45" />
        <div className="text-sm font-medium">
          {t('agentFiles.noFolder', { defaultValue: 'No working folder' })}
        </div>
        <div className="max-w-64 leading-5">
          {t('agentFiles.noFolderDesc', {
            defaultValue: 'Select a working folder to browse files.'
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <FileTreePanel
        sessionId={sessionView.sessionId}
        surface="agent"
        watchEnabled
      />
    </div>
  )
}
