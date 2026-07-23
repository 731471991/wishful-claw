// Stub: team runtime types (to be filled when team features are migrated)

export interface TeamRuntimeEvent { [key: string]: unknown }
export interface TeamRuntimeMessage { [key: string]: unknown }
export interface TeamRuntimeClient { [key: string]: unknown }
export interface TeamRuntimeInbox { [key: string]: unknown }


// ─── Auto stubs ───
export type AppendTeamRuntimeMessageArgs = Record<string, unknown>
export type ConsumeTeamRuntimeMessagesArgs = Record<string, unknown>
export type CreateTeamRuntimeArgs = Record<string, unknown>
export type DeleteTeamRuntimeArgs = Record<string, unknown>
export type GetTeamRuntimeSnapshotArgs = Record<string, unknown>
export type TeamRuntimeBackendType = string
export type TeamRuntimeCreateResult = Record<string, unknown>
export interface TeamRuntimeMessageRecord {
  id: string
  from?: string
  to?: string
  type?: string
  content?: string
  summary?: string
  timestamp?: number
}
export type TeamRuntimePermissionMode = string
export interface TeamRuntimePermissionUpdatePayload {
  permissionMode?: TeamRuntimePermissionMode
  teamAllowedPaths?: string[]
}
export interface TeamRuntimePlanApprovalRequestPayload {
  requestId: string
  plan: string
  taskId?: string
}
export interface TeamRuntimePlanApprovalResponsePayload {
  requestId: string
  approved: boolean
  feedback?: string
}
export interface TeamRuntimeSnapshotMember {
  agentId: string
  name: string
  model?: string
  agentType?: string
  backendType?: string
  role?: string
  status?: string
  currentTaskId?: string
  startedAt?: number
  completedAt?: number
}

export interface TeamRuntimeSnapshotTask {
  id: string
  subject: string
  description: string
  status: string
  owner?: string
  dependsOn: string[]
  activeForm?: string
  report?: string
}

export interface TeamRuntimeSnapshotTeam {
  name: string
  description: string
  runtimePath?: string
  leadAgentId?: string
  defaultBackend?: TeamRuntimeBackendType
  permissionMode?: TeamRuntimePermissionMode
  teamAllowedPaths: string[]
  createdAt: number
  members: TeamRuntimeSnapshotMember[]
  tasks: TeamRuntimeSnapshotTask[]
}

export interface TeamRuntimeSnapshotMessage {
  id: string
  from?: string
  to?: string
  type?: string
  content?: string
  summary?: string
  timestamp?: number
}

export interface TeamRuntimeSnapshot {
  team: TeamRuntimeSnapshotTeam
  recentMessages: TeamRuntimeSnapshotMessage[]
  [key: string]: unknown
}
export type UpdateTeamRuntimeManifestArgs = Record<string, unknown>
export type UpdateTeamRuntimeMemberArgs = Record<string, unknown>
