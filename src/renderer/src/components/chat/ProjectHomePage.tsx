import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderOpen, GitBranch, Archive } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useChatStore, type Project } from '@renderer/stores/chat-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { useChatActions } from '@renderer/hooks/use-chat-actions'
import { InputArea } from './InputArea'
import { toast } from 'sonner'

export function ProjectHomePage(): React.JSX.Element {
  const { t } = useTranslation('chat')
  const activeProjectId = useChatStore((s) => s.activeProjectId)
  const projects = useChatStore((s) => s.projects)
  const sessions = useChatStore((s) => s.sessions)
  const createSession = useChatStore((s) => s.createSession)
  const updateProjectDirectory = useChatStore((s) => s.updateProjectDirectory)
  const navigateToSession = useUIStore((s) => s.navigateToSession)
  const navigateToArchive = useUIStore((s) => s.navigateToArchive)
  const navigateToGit = useUIStore((s) => s.navigateToGit)
  const { sendMessage } = useChatActions()

  const project: Project | undefined = projects.find((p) => p.id === activeProjectId)
  const projectSessions = sessions
    .filter((s) => s.projectId === activeProjectId)
    .sort((a, b) => b.updatedAt - a.updatedAt)

  const handleSend = useCallback(async (text: string) => {
    const content = text.trim()
    if (!content || !activeProjectId) return

    const sessionId = createSession('chat', activeProjectId)
    navigateToSession(sessionId)
    await sendMessage(content, undefined, undefined, sessionId)
  }, [activeProjectId, createSession, navigateToSession, sendMessage])

  const handleChangeFolder = useCallback(async () => {
    if (!activeProjectId) return
    try {
      const result = await window.api.invoke<{ folderPath?: string; canceled?: boolean }>('dialog:openFolder', {})
      if (result && result.folderPath && !result.canceled) {
        updateProjectDirectory(activeProjectId, { workingFolder: result.folderPath })
        toast.success(t('project.folderUpdated', { defaultValue: 'Working folder updated' }))
      }
    } catch {
      toast.error(t('project.folderUpdateFailed', { defaultValue: 'Failed to select folder' }))
    }
  }, [activeProjectId, updateProjectDirectory, t])

  if (!project) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p className="text-sm">{t('project.notFound', { defaultValue: 'Project not found' })}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex flex-1 flex-col overflow-auto px-6 pb-14 pt-6">
        <div className="mx-auto w-full max-w-[760px]">
          {/* Project header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FolderOpen className="size-6 text-primary/70" />
              <div>
                <h1 className="text-xl font-bold text-foreground">{project.name}</h1>
                {project.workingFolder && (
                  <p className="mt-0.5 text-xs text-muted-foreground/60" title={project.workingFolder}>
                    {project.workingFolder}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {!project.workingFolder && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleChangeFolder}
                      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <FolderOpen className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{t('project.setFolder', { defaultValue: 'Set working folder' })}</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigateToArchive(project.id)}
                    className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Archive className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{t('project.archive', { defaultValue: 'Archive' })}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigateToGit(project.id)}
                    className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <GitBranch className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{t('project.git', { defaultValue: 'Git' })}</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Input area (composer shell) */}
          <InputArea
            sessionId={null}
            onSend={handleSend}
            isStreaming={false}
            attachedFooter
          />

          {/* Recent sessions in project */}
          {projectSessions.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground/50">
                {t('project.recentSessions', { defaultValue: 'Recent sessions' })}
              </h2>
              <div className="flex flex-col gap-1">
                {projectSessions.slice(0, 10).map((session) => (
                  <button
                    key={session.id}
                    onClick={() => navigateToSession(session.id)}
                    className="flex items-center justify-between rounded-lg border border-border/40 bg-card/30 px-3 py-2 text-left transition-colors hover:border-border hover:bg-accent/30"
                  >
                    <span className="truncate text-xs font-medium">{session.title}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground/40">
                      {session.messageCount} messages
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
