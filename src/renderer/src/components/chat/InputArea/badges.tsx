// Badge components: MCP, extensions, and read-only model indicators

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Shapes, Wrench } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useMcpStore, resolveConfiguredActiveMcpIds } from '@renderer/stores/mcp-store'
import {
  useExtensionStore,
  resolveEffectiveActiveExtensionIds
} from '@renderer/stores/extension-store'
import { ModelIcon } from '@renderer/components/settings/provider-icons'
import type { MessageRequestModelMeta } from '@renderer/lib/api/types'
import type { ImageAttachment } from '@renderer/lib/image-attachments'
import type { SendMessageOptions, ManualCompressionResult } from '@renderer/hooks/use-chat-actions'

export function ActiveMcpsBadge({ projectId }: { projectId?: string | null }): React.JSX.Element | null {
  const { t } = useTranslation('chat')
  const activeMcpIdsByProject = useMcpStore((s) => s.activeMcpIdsByProject)
  const servers = useMcpStore((s) => s.servers)
  const serverTools = useMcpStore((s) => s.serverTools)
  const activeMcpIds = React.useMemo(
    () =>
      resolveConfiguredActiveMcpIds({
        projectId,
        activeMcpIdsByProject,
        servers
      }),
    [activeMcpIdsByProject, projectId, servers]
  )
  if (activeMcpIds.length === 0) return null
  const activeServers = servers.filter((s) => activeMcpIds.includes(s.id))
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="composer-status-pill flex cursor-default items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px]">
          <span className="size-1.5 rounded-full bg-current animate-pulse opacity-80" />
          <span>{t('skills.mcpCount', { count: activeMcpIds.length })}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs font-medium">{t('skills.activeMcpServers')}</p>
        {activeServers.map((s) => (
          <p key={s.id} className="text-xs text-muted-foreground">
            {s.name} ({t('skills.mcpToolCount', { count: serverTools[s.id]?.length ?? 0 })})
          </p>
        ))}
      </TooltipContent>
    </Tooltip>
  )
}

export function ActiveExtensionsBadge({
  projectId
}: {
  projectId?: string | null
}): React.JSX.Element | null {
  const { t } = useTranslation('chat')
  const activeExtensionIdsByProject = useExtensionStore((s) => s.activeExtensionIdsByProject)
  const extensions = useExtensionStore((s) => s.extensions)
  const activeExtensionIds = React.useMemo(
    () =>
      resolveEffectiveActiveExtensionIds({
        projectId,
        activeExtensionIdsByProject,
        extensions
      }),
    [activeExtensionIdsByProject, extensions, projectId]
  )
  if (activeExtensionIds.length === 0) return null

  const activeExtensions = extensions.filter((extension) =>
    activeExtensionIds.includes(extension.id)
  )
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="composer-status-pill flex cursor-default items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px]">
          <Shapes className="size-3" />
          <span>{t('skills.extensionCount', { count: activeExtensionIds.length })}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs font-medium">{t('skills.activeCustomExtensions')}</p>
        {activeExtensions.map((extension) => (
          <p key={extension.id} className="text-xs text-muted-foreground">
            {extension.manifest.name} (
            {t('skills.extensionToolCount', { count: extension.manifest.tools.length })})
          </p>
        ))}
      </TooltipContent>
    </Tooltip>
  )
}

export function ReadOnlyModelBadge({
  model
}: {
  model?: MessageRequestModelMeta | null
}): React.JSX.Element {
  const { t } = useTranslation('chat')
  const modelName =
    model?.modelName?.trim() ||
    model?.modelId?.trim() ||
    t('input.modelResolving', { defaultValue: 'Model pending' })
  const providerName =
    model?.providerName?.trim() ||
    model?.providerBuiltinId?.trim() ||
    model?.providerId?.trim() ||
    ''
  const title = providerName
    ? t('input.readOnlyModelWithProvider', {
        defaultValue: 'Sub-agent model: {{model}} · {{provider}}',
        model: modelName,
        provider: providerName
      })
    : t('input.readOnlyModel', {
        defaultValue: 'Sub-agent model: {{model}}',
        model: modelName
      })

  return (
    <div
      className="composer-control inline-flex h-8 max-w-[14rem] cursor-default items-center gap-2 rounded-lg border border-border/65 bg-muted/35 px-2 text-left text-foreground/85"
      title={title}
      aria-label={title}
      aria-readonly="true"
    >
      <ModelIcon
        icon={model?.modelIcon ?? undefined}
        modelId={model?.modelId ?? undefined}
        providerBuiltinId={model?.providerBuiltinId ?? undefined}
        size={16}
        className="shrink-0"
      />
      <span className="min-w-0 truncate text-xs font-medium">{modelName}</span>
    </div>
  )
}

interface InputAreaProps {
  sessionId?: string | null
  onSend: (text: string, images?: ImageAttachment[], options?: SendMessageOptions) => void
  onStop?: () => void
  onSelectFolder?: () => void
  isStreaming?: boolean
  workingFolder?: string
  hideWorkingFolderIndicator?: boolean
  hideWorkingFolderPicker?: boolean
  onCompressContext?: () => ManualCompressionResult | void | Promise<ManualCompressionResult | void>
  disabled?: boolean
  draftKeyOverride?: string | null
  suppressPendingQueue?: boolean
  hideGoalSessionBar?: boolean
  hideModeSwitch?: boolean
  modelRoute?: 'main' | 'fast'
  readOnlyModel?: MessageRequestModelMeta | null
  attachedFooter?: boolean
  fullWidth?: boolean
}

