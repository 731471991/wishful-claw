import type { SessionMemoryScope } from '../memory-files'
import { loadLayeredMemorySnapshot } from '../memory-files'
import type { IPCClient } from '../../tools/tool-types'

export async function resolveSubAgentWorkspaceProtocolPrompt(options: {
  ipc: IPCClient
  workingFolder?: string
  sshConnectionId?: string | null
  scope?: SessionMemoryScope
}): Promise<string | null> {
  if (!options.workingFolder?.trim()) return null
  try {
    const snapshot = await loadLayeredMemorySnapshot(options.ipc, {
      workingFolder: options.workingFolder,
      sshConnectionId: options.sshConnectionId ?? undefined,
      scope: options.scope ?? 'main'
    })
    const agentsContent = snapshot.agents?.content?.trim()
    if (!agentsContent) return null
    const source = snapshot.agents?.path ? ` from \`${snapshot.agents.path}\`` : ''
    return [
      '<workspace_protocol priority="high">',
      `The following AGENTS.md${source} is the authoritative workspace protocol for this sub-agent run.`,
      'Follow it for project structure, commands, style, testing expectations, and repository-specific constraints unless a higher-priority system/developer/user instruction conflicts.',
      '',
      agentsContent,
      '</workspace_protocol>'
    ].join('\n')
  } catch (error) {
    console.warn('[SubAgent] Failed to load workspace AGENTS.md context:', error)
    return null
  }
}

export function appendSystemPromptSection(systemPrompt: string, section: string | null): string {
  if (!section?.trim()) return systemPrompt
  return `${systemPrompt.trim()}\n\n${section.trim()}`
}
