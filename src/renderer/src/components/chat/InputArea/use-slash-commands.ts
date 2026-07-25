import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { listCommands, type CommandCatalogItem } from '@renderer/lib/commands/command-loader'
import { useSkillsStore } from '@renderer/stores/skills-store'
import { resolvePluginsForProject, useAppPluginStore } from '@renderer/stores/app-plugin-store'
import { APP_PLUGIN_DESCRIPTORS, type AppPluginId } from '@renderer/lib/app-plugin/types'
import { getSlashCommandQuery, scoreSlashCommand } from './utils'
import {
  createPluginReferenceNode, createTextReplacementNode,
  replaceEditorRange, type EditorDocumentNode, type SelectedFileItem
} from '@renderer/lib/select-file-editor'
import { getAppPluginPromptContent } from './utils'
import type { SlashSuggestionItem, AppPluginPromptItem } from './types'
import { BUILTIN_SLASH_COMMANDS, MAX_SLASH_COMMAND_RESULTS } from './types'

interface UseSlashCommandsOptions {
  text: string
  workingFolder?: string
  activeProjectId: string | null
  editorRef: React.RefObject<{ getSelectionOffsets: () => { start: number; end: number }; focusAtEnd: () => void } | null>
  editorSelection: { start: number; end: number }
  selectedFiles: SelectedFileItem[]
  selectedFilesRef: React.RefObject<SelectedFileItem[]>
  documentRef: React.RefObject<EditorDocumentNode[]>
  applyEditorStateFromSerializedText: (text: string, files?: SelectedFileItem[]) => void
  focusInputAtEnd: () => void
  setSelectedSkill: (name: string | null) => void
  setSelectedFiles: React.Dispatch<React.SetStateAction<SelectedFileItem[]>>
  setDocumentNodes: React.Dispatch<React.SetStateAction<EditorDocumentNode[]>>
  slashListRef: React.RefObject<HTMLDivElement | null>
}

export function useSlashCommands(opts: UseSlashCommandsOptions) {
  const { t } = useTranslation('chat')
  const [slashCommands, setSlashCommands] = React.useState<CommandCatalogItem[]>([])
  const [slashCommandsLoading, setSlashCommandsLoading] = React.useState(false)
  const [selectedSlashIndex, setSelectedSlashIndex] = React.useState(0)
  const { installedSkills, skillsLoading, loadSkills } = useSkillsStore(
    useShallow((s) => ({
      installedSkills: s.skills,
      skillsLoading: s.loading,
      loadSkills: s.loadSkills
    }))
  )
  const pluginsByProject = useAppPluginStore((s) => s.pluginsByProject)

  const slashQuery = React.useMemo(() => getSlashCommandQuery(opts.text), [opts.text])
  const slashMenuOpen = slashQuery !== null
  const slashSuggestionsLoading = slashCommandsLoading || skillsLoading

  const availableAppPlugins = React.useMemo<AppPluginPromptItem[]>(() => {
    const projectPlugins = resolvePluginsForProject(pluginsByProject, opts.activeProjectId)
    return APP_PLUGIN_DESCRIPTORS.filter((d) => !d.hidden)
      .map((descriptor) => {
        const plugin = projectPlugins.find((item) => item.id === descriptor.id)
        if (!plugin?.enabled) return null
        return {
          id: descriptor.id,
          title: t(`plugin.items.${descriptor.id}.title`, { ns: 'settings', defaultValue: descriptor.id }),
          description: t(`plugin.items.${descriptor.id}.description`, { ns: 'settings', defaultValue: '' })
        }
      })
      .filter((item): item is AppPluginPromptItem => item !== null)
  }, [opts.activeProjectId, pluginsByProject, t])

  const filteredSlashSuggestions = React.useMemo(() => {
    const query = slashQuery ?? ''
    const suggestionsByIdentity = new Map<string, SlashSuggestionItem>()

    for (const command of [...BUILTIN_SLASH_COMMANDS, ...slashCommands]) {
      suggestionsByIdentity.set(`command:${command.name.toLowerCase()}`, {
        key: `command:${command.name}`,
        name: command.name,
        summary: command.summary,
        kind: 'command'
      })
    }

    for (const plugin of availableAppPlugins) {
      suggestionsByIdentity.set(`plugin:${plugin.id}`, {
        key: `plugin:${plugin.id}`,
        name: plugin.id,
        label: plugin.title,
        summary: plugin.description,
        kind: 'plugin',
        pluginId: plugin.id
      })
    }

    const appPluginIds = new Set(
      APP_PLUGIN_DESCRIPTORS.filter((d) => !d.hidden).map((d) => d.id)
    )
    for (const skill of installedSkills) {
      if (appPluginIds.has(skill.name as AppPluginId)) continue
      suggestionsByIdentity.set(`skill:${skill.name.toLowerCase()}`, {
        key: `skill:${skill.name}`,
        name: skill.name,
        summary: skill.description,
        kind: 'skill'
      })
    }

    return [...suggestionsByIdentity.values()]
      .map((item) => ({ item, score: scoreSlashCommand(item.name, query) }))
      .filter((item) => Number.isFinite(item.score))
      .sort((left, right) => {
        if (left.score !== right.score) return left.score - right.score
        if (left.item.kind !== right.item.kind) {
          const order = { command: 0, plugin: 1, skill: 2 }
          return order[left.item.kind] - order[right.item.kind]
        }
        return left.item.name.localeCompare(right.item.name, undefined, { sensitivity: 'base' })
      })
      .slice(0, MAX_SLASH_COMMAND_RESULTS)
      .map((item) => item.item)
  }, [availableAppPlugins, installedSkills, slashCommands, slashQuery])

  React.useEffect(() => {
    if (!slashMenuOpen) {
      setSelectedSlashIndex(0)
      setSlashCommandsLoading(false)
      return
    }
    let cancelled = false
    setSlashCommandsLoading(true)
    void Promise.all([listCommands(), loadSkills()])
      .then(([commands]) => { if (!cancelled) setSlashCommands(commands) })
      .finally(() => { if (!cancelled) setSlashCommandsLoading(false) })
    return () => { cancelled = true }
  }, [loadSkills, slashMenuOpen])

  React.useEffect(() => { setSelectedSlashIndex(0) }, [slashQuery])

  React.useEffect(() => {
    if (!slashMenuOpen) return
    const items = opts.slashListRef.current?.querySelectorAll('button')
    items?.[selectedSlashIndex]?.scrollIntoView({ block: 'nearest' })
  }, [selectedSlashIndex, slashMenuOpen])

  const insertSlashCommand = React.useCallback(
    (commandName: string) => {
      opts.setSelectedSkill(null)
      opts.applyEditorStateFromSerializedText(`/${commandName} `, opts.selectedFiles)
      requestAnimationFrame(() => opts.focusInputAtEnd())
    },
    [opts.applyEditorStateFromSerializedText, opts.focusInputAtEnd, opts.selectedFiles, opts.setSelectedSkill]
  )

  const selectSlashSkill = React.useCallback(
    (skillName: string) => {
      opts.setSelectedSkill(skillName)
      opts.applyEditorStateFromSerializedText('')
      requestAnimationFrame(() => opts.focusInputAtEnd())
    },
    [opts.applyEditorStateFromSerializedText, opts.focusInputAtEnd, opts.setSelectedSkill]
  )

  const insertPluginPrompt = React.useCallback(
    (pluginId: AppPluginId, replaceAll = false) => {
      opts.setSelectedSkill(null)
      const plugin = availableAppPlugins.find((item) => item.id === pluginId)
      const label = plugin?.title ?? pluginId
      const pluginNode = createPluginReferenceNode(pluginId, label, getAppPluginPromptContent(pluginId))
      const pluginDocument: EditorDocumentNode[] = [pluginNode, createTextReplacementNode('\n')]

      if (replaceAll) {
        opts.setDocumentNodes(pluginDocument)
        opts.setSelectedFiles([])
        requestAnimationFrame(() => opts.focusInputAtEnd())
        return
      }

      if (opts.documentRef.current.some((node) => node.type === 'plugin' && node.pluginId === pluginId)) {
        requestAnimationFrame(() => opts.focusInputAtEnd())
        return
      }

      const selection = opts.editorRef.current?.getSelectionOffsets() ?? opts.editorSelection
      const nextDocument = replaceEditorRange(
        opts.documentRef.current, opts.selectedFilesRef.current,
        selection.start, selection.end, pluginDocument
      )
      const referencedFileIds = new Set(
        nextDocument
          .filter((node): node is Extract<EditorDocumentNode, { type: 'file' }> => node.type === 'file')
          .map((node) => node.fileId)
      )
      opts.setDocumentNodes(nextDocument)
      opts.setSelectedFiles((currentFiles) => currentFiles.filter((file) => referencedFileIds.has(file.id)))
      requestAnimationFrame(() => opts.focusInputAtEnd())
    },
    [availableAppPlugins, opts]
  )

  const applySlashSuggestion = React.useCallback(
    (item: SlashSuggestionItem) => {
      if (item.kind === 'skill') { selectSlashSkill(item.name); return }
      if (item.kind === 'plugin' && item.pluginId) { insertPluginPrompt(item.pluginId, true); return }
      insertSlashCommand(item.name)
    },
    [insertPluginPrompt, insertSlashCommand, selectSlashSkill]
  )

  return {
    slashQuery, slashMenuOpen, slashSuggestionsLoading,
    filteredSlashSuggestions, selectedSlashIndex, setSelectedSlashIndex,
    availableAppPlugins, insertSlashCommand, selectSlashSkill,
    insertPluginPrompt, applySlashSuggestion
  }
}

import { useShallow } from 'zustand/react/shallow'
