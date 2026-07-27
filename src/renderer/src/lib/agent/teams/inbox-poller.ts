import type { ToolCallState } from '../types'

import { seenMessageIds, approvalRequestToToolCallId, getTeamPollKey, initializeTeamCursor, clearTeamCursor, parseToolCall, parsePermissionUpdate, parsePlanApprovalRequest, registerPendingApproval } from './inbox-parsers'
import { inboxPollerState } from './inbox-poller-state'


export async function sendApprovalResponse(params: {

  requestId: string

  approved: boolean

  to?: string

  summary?: string

}): Promise<void> {

  const team = useTeamStore.getState().activeTeam

  if (!team) return



  approvalRequestToToolCallId.delete(params.requestId)



  await appendTeamRuntimeMessage({

    teamName: team.name,

    message: {

      id: `perm-res-${params.requestId}-${Date.now()}`,

      from: 'lead',

      to: params.to,

      type: 'permission_response',

      content: JSON.stringify({ approved: params.approved, requestId: params.requestId }),

      summary: params.summary,

      timestamp: Date.now()

    }

  })

}



export async function sendPlanApprovalResponse(params: {

  requestId: string

  approved: boolean

  to?: string

  feedback?: string

}): Promise<void> {

  const team = useTeamStore.getState().activeTeam

  if (!team) return



  const payload: TeamRuntimePlanApprovalResponsePayload = {

    requestId: params.requestId,

    approved: params.approved,

    ...(params.feedback ? { feedback: params.feedback } : {})

  }



  await appendTeamRuntimeMessage({

    teamName: team.name,

    message: {

      id: `plan-res-${params.requestId}-${Date.now()}`,

      from: 'lead',

      to: params.to,

      type: 'plan_approval_response',

      content: JSON.stringify(payload),

      summary: params.approved ? 'Leader approved plan' : 'Leader rejected plan',

      timestamp: Date.now()

    }

  })

}



async function handleLeadMessage(message: TeamMessage, sessionId?: string): Promise<void> {

  if (seenMessageIds.has(message.id)) return

  seenMessageIds.add(message.id)

  lastLeadMessageTimestamp = Math.max(lastLeadMessageTimestamp, message.timestamp ?? 0)



  if (message.type === 'permission_request') {

    const toolCall = parseToolCall(message.content)

    if (!toolCall) return



    useAgentStore.getState().addToolCall({

      ...toolCall,

      status: 'pending_approval',

      requiresApproval: true

    })



    registerPendingApproval(message.id, toolCall.id, message.from)

    return

  }



  if (message.type === 'team_permission_update' || message.type === 'mode_set_request') {

    const payload = parsePermissionUpdate(message.content)

    if (!payload) return



    useTeamStore.getState().updateTeamMeta({

      ...(payload.permissionMode ? { permissionMode: payload.permissionMode } : {}),

      ...(payload.teamAllowedPaths ? { teamAllowedPaths: payload.teamAllowedPaths } : {})

    })

    return

  }



  if (message.type === 'plan_approval_request') {

    const payload = parsePlanApprovalRequest(message.content)

    if (!payload) return



    const syntheticToolCall: ToolCallState = {

      id: `plan-${payload.requestId}`,

      name: 'PlanApproval',

      input: {

        task_id: payload.taskId ?? null,

        plan: payload.plan,

        from: message.from

      },

      status: 'pending_approval',

      requiresApproval: true

    }



    useAgentStore.getState().addToolCall(syntheticToolCall)

    useAgentStore.getState().registerApprovalSource(syntheticToolCall.id, {

      requestId: payload.requestId,

      replyTo: message.from ?? '',

      source: 'teammate-plan'

    })

    return

  }



  if (LEAD_WAKE_MESSAGE_TYPES.has(message.type ?? '')) {

    teamEvents.emit({ type: 'team_message', sessionId, message })

  }

}



export function startTeamInboxPoller(): void {

  if (inboxPollerState.pollerTimer) return



  inboxPollerState.pollerStartedAt = Date.now()

  const initialTeam = useTeamStore.getState().activeTeam

  if (initialTeam?.name) {

    // Persisted messages belonged to an earlier app lifetime and must not wake

    // the main agent again. New messages arriving after this cursor still do.

    initializeTeamCursor(initialTeam, true)

  }



  inboxPollerState.pollerTimer = setInterval(() => {

    const team = useTeamStore.getState().activeTeam

    if (!team?.name) {

      if (inboxPollerState.activePollTeamKey) clearTeamCursor()

      return

    }



    const teamKey = getTeamPollKey(team)

    if (inboxPollerState.activePollTeamKey !== teamKey) {

      // A team created after the poller started is live. Do not seed from its

      // snapshot: a very fast teammate may already have completed before this

      // first interval and its report still needs to wake the main agent.

      initializeTeamCursor(team, team.createdAt < inboxPollerState.pollerStartedAt)

    }

    const sessionId = team.sessionId



    void consumeTeamRuntimeMessages({

      teamName: team.name,

      // The runtime filter is strictly greater-than. Re-read the previous

      // millisecond and rely on message IDs so two batches sharing one timestamp

      // cannot strand the later message.

      afterTimestamp: Math.max(0, lastLeadMessageTimestamp - 1),

      recipient: 'lead',

      includeBroadcast: true,

      limit: 50

    })

      .then(async (messages) => {

        const currentTeam = useTeamStore.getState().activeTeam

        if (!currentTeam || getTeamPollKey(currentTeam) !== teamKey) return



        for (const message of messages) {

          await handleLeadMessage(

            {

              id: message.id,

              from: message.from,

              to: message.to,

              type: message.type,

              content: message.content,

              summary: message.summary,

              timestamp: message.timestamp

            },

            sessionId

          )

        }

      })

      .catch((error) => {

        console.error('[TeamRuntime] Lead inbox poll failed:', error)

      })

  }, 1000)

}



export function stopTeamInboxPoller(): void {

  if (inboxPollerState.pollerTimer) {

    clearInterval(inboxPollerState.pollerTimer)

    inboxPollerState.pollerTimer = null

  }

  clearTeamCursor()

  inboxPollerState.pollerStartedAt = 0

}

