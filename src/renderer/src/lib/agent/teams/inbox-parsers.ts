import type { ToolCallState } from '../types'

import type {

  TeamRuntimePermissionUpdatePayload,

  TeamRuntimePlanApprovalRequestPayload,

  TeamRuntimePlanApprovalResponsePayload

} from '../../../../../shared/team-runtime-types'

import { useAgentStore } from '../../../stores/agent-store'

import { useTeamStore, type ActiveTeam } from '../../../stores/team-store'

import type { TeamMessage } from './types'

import { teamEvents } from './events'

import { appendTeamRuntimeMessage, consumeTeamRuntimeMessages } from './runtime-client'



export let pollerTimer: ReturnType<typeof setInterval> | null = null

export let pollerStartedAt = 0

export let activePollTeamKey: string | null = null

let lastLeadMessageTimestamp = 0

export const seenMessageIds = new Set<string>()

export const approvalRequestToToolCallId = new Map<string, string>()

const LEAD_WAKE_MESSAGE_TYPES = new Set([

  'message',

  'broadcast',

  'idle_notification',

  'shutdown_response'

])



export function getTeamPollKey(team: ActiveTeam): string {

  return `${team.name}:${team.createdAt}`

}



export function initializeTeamCursor(team: ActiveTeam, seedExistingMessages: boolean): void {

  activePollTeamKey = getTeamPollKey(team)

  seenMessageIds.clear()

  approvalRequestToToolCallId.clear()



  lastLeadMessageTimestamp = team.createdAt

  if (seedExistingMessages) {

    lastLeadMessageTimestamp = Math.max(lastLeadMessageTimestamp, team.lastRuntimeSyncAt ?? 0)

    for (const message of team.messages) {

      seenMessageIds.add(message.id)

      lastLeadMessageTimestamp = Math.max(lastLeadMessageTimestamp, message.timestamp ?? 0)

    }

  }

}



export function clearTeamCursor(): void {

  activePollTeamKey = null

  lastLeadMessageTimestamp = 0

  seenMessageIds.clear()

  approvalRequestToToolCallId.clear()

}



export function parseToolCall(content?: string): ToolCallState | null {

  if (!content) return null

  try {

    const parsed = JSON.parse(content) as ToolCallState

    if (!parsed || typeof parsed !== 'object') return null

    if (typeof parsed.id !== 'string' || typeof parsed.name !== 'string') return null

    if (!parsed.input || typeof parsed.input !== 'object') return null

    return parsed

  } catch {

    return null

  }

}



export function parsePermissionUpdate(content?: string): TeamRuntimePermissionUpdatePayload | null {

  if (!content) return null

  try {

    const parsed = JSON.parse(content) as TeamRuntimePermissionUpdatePayload

    if (!parsed || typeof parsed !== 'object') return null

    return parsed

  } catch {

    return null

  }

}



export function parsePlanApprovalRequest(content?: string): TeamRuntimePlanApprovalRequestPayload | null {

  if (!content) return null

  try {

    const parsed = JSON.parse(content) as TeamRuntimePlanApprovalRequestPayload

    if (!parsed || typeof parsed.requestId !== 'string' || typeof parsed.plan !== 'string') {

      return null

    }

    return parsed

  } catch {

    return null

  }

}



export function registerPendingApproval(requestId: string, toolCallId: string, replyTo?: string): void {

  approvalRequestToToolCallId.set(requestId, toolCallId)

  useAgentStore.getState().registerApprovalSource(toolCallId, { requestId, replyTo })

}


