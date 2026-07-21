import { ipcClient } from '../../ipc/ipc-client'
import { resolveSubAgentMaxTurns } from './limits'
import { subAgentRegistry } from './registry'
import type { SubAgentDefinition } from './types'

/** Shape returned by the agents:list IPC handler */
export interface AgentInfo {
  name: string
  description: string
  icon?: string
  tools?: string[]
  allowedTools?: string[]
  disallowedTools?: string[]
  maxTurns?: number
  maxIterations?: number
  initialPrompt?: string
  background?: boolean
  model?: string
  temperature?: number
  systemPrompt: string
}

export type SubAgentRegistryRefreshStatus = 'changed' | 'unchanged' | 'failed'

let registeredAgentSignature = ''

/** Convert an IPC AgentInfo into a SubAgentDefinition */
function toDefinition(info: AgentInfo): SubAgentDefinition {
  return {
    name: info.name,
    description: info.description,
    icon: info.icon,
    tools: info.tools ?? info.allowedTools ?? ['Read', 'Glob', 'Grep', 'LS', 'Bash'],
    disallowedTools: info.disallowedTools ?? [],
    maxTurns: resolveSubAgentMaxTurns(info.maxTurns ?? info.maxIterations),
    initialPrompt: info.initialPrompt,
    background: info.background,
    model: info.model,
    temperature: info.temperature,
    systemPrompt: info.systemPrompt,
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The detailed task for the sub-agent to perform'
        }
      },
      required: ['prompt']
    }
  }
}

function normalizeStringList(value: string[] | undefined): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.map((item) => item.trim()).filter(Boolean)
}

function normalizeAgentInfos(agents: AgentInfo[]): AgentInfo[] {
  return agents
    .filter((agent) => agent.name?.trim() && agent.description?.trim())
    .map((agent) => ({
      ...agent,
      name: agent.name.trim(),
      description: agent.description.trim(),
      tools: normalizeStringList(agent.tools),
      allowedTools: normalizeStringList(agent.allowedTools),
      disallowedTools: normalizeStringList(agent.disallowedTools)
    }))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
}

function buildAgentSignature(agents: AgentInfo[]): string {
  return JSON.stringify(
    agents.map((agent) => ({
      name: agent.name,
      description: agent.description,
      icon: agent.icon,
      tools: agent.tools,
      allowedTools: agent.allowedTools,
      disallowedTools: agent.disallowedTools,
      maxTurns: agent.maxTurns,
      maxIterations: agent.maxIterations,
      initialPrompt: agent.initialPrompt,
      background: agent.background,
      model: agent.model,
      temperature: agent.temperature,
      systemPrompt: agent.systemPrompt
    }))
  )
}

async function loadAgentInfos(): Promise<AgentInfo[] | null> {
  try {
    const agents = (await ipcClient.invoke('agents:list')) as AgentInfo[]
    return Array.isArray(agents) ? agents : []
  } catch (err) {
    console.error('[SubAgents] Failed to load agents from IPC:', err)
    return null
  }
}

function syncSubAgentRegistry(agents: AgentInfo[]): void {
  const definitions = agents.map(toDefinition)
  const nextNames = new Set(definitions.map((definition) => definition.name))

  for (const currentName of subAgentRegistry.getNames()) {
    if (!nextNames.has(currentName)) {
      subAgentRegistry.unregister(currentName)
    }
  }

  for (const definition of definitions) {
    subAgentRegistry.register(definition)
  }
}

export async function refreshSubAgentRegistry(): Promise<SubAgentRegistryRefreshStatus> {
  const agents = await loadAgentInfos()
  if (!agents) return 'failed'

  const normalizedAgents = normalizeAgentInfos(agents)
  const nextSignature = buildAgentSignature(normalizedAgents)
  if (nextSignature === registeredAgentSignature) return 'unchanged'

  syncSubAgentRegistry(normalizedAgents)
  registeredAgentSignature = nextSignature
  return 'changed'
}
