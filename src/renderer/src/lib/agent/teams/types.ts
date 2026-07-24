import type {
  TeamRuntimeBackendType,
  TeamRuntimePermissionMode
} from '../../../../../shared/team-runtime-types'

export interface TeamMember {
  id: string
  name: string
  model?: string
  agentName?: string
  backendType?: string
  role?: string
  status?: string
  currentTaskId?: string | null
  iteration?: number
  toolCalls?: unknown[]
  streamingText?: string
  startedAt?: number
  completedAt?: number | null
  usage?: unknown
}

export interface TeamTask {
  id: string
  description: string
  subject: string
  status: 'pending' | 'in_progress' | 'completed' | string
  activeForm?: string
  assignedTo?: string
  owner?: string
  report?: string
  dependsOn?: string[]
}

export interface TeamMessage {
  id: string
  from?: string
  to?: string
  type?: string
  content?: string
  summary?: string
  timestamp?: number
}

export interface TeamEvent {
  type: string
  sessionId?: string
  teamName?: string
  description?: string
  runtimePath?: string
  leadAgentId?: string
  defaultBackend?: TeamRuntimeBackendType
  permissionMode?: TeamRuntimePermissionMode
  teamAllowedPaths?: string[]
  createdAt?: number
  member?: TeamMember
  memberId?: string
  patch?: Record<string, unknown>
  task?: TeamTask
  taskId?: string
  message?: TeamMessage
  [key: string]: unknown
}
