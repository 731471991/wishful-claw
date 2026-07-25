import * as React from 'react'
import { Send, FolderOpen, Globe, Wand2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Spinner } from '@renderer/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useTranslation } from 'react-i18next'
import { SkillsMenu } from '../SkillsMenu'
import { ModelSwitcher } from '../ModelSwitcher'
import { PersonaSwitcher } from '../PersonaSwitcher'
import { ContextRing } from './context-ring'
import { ActiveMcpsBadge, ActiveExtensionsBadge, ReadOnlyModelBadge } from './badges'
import { PermissionControl } from './permission-control'
import { ClearConversationDialog } from './clear-conversation-dialog'
import type { MessageRequestModelMeta } from '@renderer/lib/api/types'

interface ComposerToolbarProps {
  // Model
  readOnlyModel?: MessageRequestModelMeta | null
  modelRoute: 'main' | 'fast'
  draftSessionId: string | null

  // Web search
  canToggleWebSearch: boolean
  webSearchEnabled: boolean
  toggleWebSearch: () => void
  disabled: boolean
  isStreaming: boolean

  // Skills menu
  setSelectedSkill: (name: string | null) => void
  insertSlashCommand: (name: string) => void
  insertPluginPrompt: (pluginId: string, focus?: boolean) => void
  handleAttachMedia: () => void
  activeProjectId: string | null
  mode: string
  hideModeSwitch: boolean
  planMode: boolean
  goalModeEnabled: boolean
  planModeDisabled: boolean
  goalModeDisabled: boolean
  onPlanModeChange: (enabled: boolean) => void
  onGoalModeChange: (enabled: boolean) => void

  // Folder
  onSelectFolder?: () => void
  hideWorkingFolderPicker: boolean

  // Optimize
  isOptimizing: boolean
  isOptimizingLocked: boolean
  handleOptimizePrompt: () => void
  hasText: boolean

  // Permission
  permissionMode: 'default' | 'whitelist' | 'fullAccess'
  onSelectPermissionMode: (mode: 'default' | 'whitelist' | 'fullAccess') => Promise<void>
  onOpenSettings: (tab: string) => void

  // Send
  onStop?: () => void
  onSend: () => void
  finalSerializedText: string
  attachedImagesCount: number
  needsWorkingFolder: boolean
  pendingImageReads: number

  // Context ring
  onCompressContext?: () => void
  isContextCompressing: boolean

  // Clear conversation
  showInlineClearConversation: boolean
  hasMessages: boolean
  activeSessionId: string | null
  queuedMessagesCount: number
  onClearSession: (sessionId: string) => void

  // Styling
  composerIconControlClass: string

  // Ref for height measurement
  toolbarRef?: React.Ref<HTMLDivElement>
}

export function ComposerToolbar(props: ComposerToolbarProps) {
  const { t } = useTranslation('chat')
  const {
    readOnlyModel, modelRoute, draftSessionId,
    canToggleWebSearch, webSearchEnabled, toggleWebSearch, disabled, isStreaming,
    setSelectedSkill, insertSlashCommand, insertPluginPrompt, handleAttachMedia,
    activeProjectId, mode, hideModeSwitch, planMode, goalModeEnabled,
    planModeDisabled, goalModeDisabled, onPlanModeChange, onGoalModeChange,
    onSelectFolder, hideWorkingFolderPicker,
    isOptimizing, isOptimizingLocked, handleOptimizePrompt, hasText,
    permissionMode, onSelectPermissionMode, onOpenSettings,
    onStop, onSend, finalSerializedText, attachedImagesCount, needsWorkingFolder, pendingImageReads,
    onCompressContext, isContextCompressing,
    showInlineClearConversation, hasMessages, activeSessionId, queuedMessagesCount, onClearSession,
    composerIconControlClass, toolbarRef
  } = props

  const composerVariant = 'session'

  const webSearchToggleControl = canToggleWebSearch && (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={composerIconControlClass}
          data-active={webSearchEnabled ? 'true' : 'false'}
          onClick={toggleWebSearch}
          disabled={disabled || isStreaming}
        >
          <Globe className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {webSearchEnabled
          ? t('input.disableWebSearch', { defaultValue: 'Disable web search' })
          : t('input.enableWebSearch', { defaultValue: 'Enable web search' })}
      </TooltipContent>
    </Tooltip>
  )

  const skillsMenuControl = (
    <SkillsMenu
      onSelectSkill={(name) => {
        setSelectedSkill(name)
      }}
      onSelectCommand={(name) => {
        insertSlashCommand(name)
      }}
      onSelectPlugin={(pluginId) => {
        insertPluginPrompt(pluginId)
      }}
      onAttachMedia={() => void handleAttachMedia()}
      disabled={disabled || isStreaming}
      projectId={activeProjectId ?? undefined}
      showChannels={mode !== 'chat'}
      triggerClassName={composerIconControlClass}
      menuClassName="composer-flyout"
      showModeToggles={!hideModeSwitch}
      planModeEnabled={planMode}
      goalModeEnabled={goalModeEnabled}
      planModeDisabled={planModeDisabled}
      goalModeDisabled={goalModeDisabled}
      onPlanModeChange={onPlanModeChange}
      onGoalModeChange={onGoalModeChange}
    />
  )

  const activeMcpBadge = <ActiveMcpsBadge projectId={activeProjectId} />
  const activeExtensionBadge = <ActiveExtensionsBadge projectId={activeProjectId} />

  const folderControl = onSelectFolder && !hideWorkingFolderPicker && (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={composerIconControlClass}
          onClick={onSelectFolder}
        >
          <FolderOpen className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t('input.selectFolder')}</TooltipContent>
    </Tooltip>
  )

  const optimizeControl = !isStreaming && (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={composerIconControlClass}
          onClick={handleOptimizePrompt}
          disabled={!hasText || disabled || isOptimizingLocked}
        >
          {isOptimizing ? <Spinner className="size-4" /> : <Wand2 className="size-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isOptimizing ? t('input.optimizing') : t('input.optimizePrompt')}
      </TooltipContent>
    </Tooltip>
  )

  const permissionControl = (
    <PermissionControl
      permissionMode={permissionMode}
      onSelectMode={onSelectPermissionMode}
      onOpenSettings={(tab) => onOpenSettings(tab as never)}
    />
  )

  const sendControl = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="default"
          className="composer-send rounded-xl px-3.5 transition-[filter,box-shadow] duration-200"
          data-composer-variant={composerVariant}
          data-tone={isStreaming ? 'warning' : undefined}
          onMouseDown={(event) => {
            event.preventDefault()
          }}
          onClick={isStreaming ? () => onStop?.() : onSend}
          disabled={
            isStreaming
              ? false
              : (!finalSerializedText.trim() && attachedImagesCount === 0) ||
                disabled ||
                needsWorkingFolder ||
                pendingImageReads > 0 ||
                isOptimizingLocked
          }
          aria-label={isStreaming ? t('input.stopTooltip') : t('input.sendTooltip')}
        >
          {isStreaming ? (
            <>
              <Spinner className="mr-1.5 size-3.5" />
              <span>{t('action.stop', { ns: 'common' })}</span>
            </>
          ) : (
            <>
              <span>{t(draftSessionId ? 'action.send' : 'action.start', { ns: 'common' })}</span>
              <Send className="ml-1.5 size-3.5" />
            </>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isStreaming ? t('input.stopTooltip') : t('input.sendTooltip')}
      </TooltipContent>
    </Tooltip>
  )

  return (
    <div
      ref={toolbarRef}
      className="composer-toolbar relative z-20 mt-1 shrink-0 flex items-center justify-between gap-2 px-2 pb-2"
    >
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pr-1 [scrollbar-width:none]">
          <div className="shrink-0">
            {readOnlyModel !== undefined ? (
              <ReadOnlyModelBadge model={readOnlyModel} />
            ) : (
              <ModelSwitcher modelRoute={modelRoute} sessionId={draftSessionId} />
            )}
          </div>
          {draftSessionId && (
            <div className="shrink-0">
              <PersonaSwitcher sessionId={draftSessionId} />
            </div>
          )}
          {webSearchToggleControl}
          {skillsMenuControl}
          {activeMcpBadge}
          {activeExtensionBadge}
          {folderControl}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <ContextRing
            sessionId={draftSessionId}
            onCompressContext={onCompressContext}
            isCompressing={isContextCompressing}
          />

          <ClearConversationDialog
            show={showInlineClearConversation}
            hasMessages={hasMessages}
            isStreaming={isStreaming}
            activeSessionId={activeSessionId}
            queuedMessagesCount={queuedMessagesCount}
            onClearSession={onClearSession}
          />

          {optimizeControl}
          {permissionControl}
          {sendControl}
        </div>
      </div>
    </div>
  )
}
