/**
 * Agent change tracking IPC handlers.
 *
 * Forwards change tracking requests from the Renderer to the Worker.
 * The Worker stores change sets in-memory and handles diff/rollback.
 */

import { getNativeWorker } from '../lib/native-worker'
import { registerMessagePackHandler } from './messagepack-handler'

const REQUEST_TIMEOUT_MS = 120_000

export function registerAgentChangeHandlers(): void {
  registerMessagePackHandler<{ sessionId: string }, unknown>(
    'agent:changes:list-session',
    async (args) => {
      try {
        return await getNativeWorker().request(
          'agent-changes/list-session-hydrated',
          { sessionId: args.sessionId },
          REQUEST_TIMEOUT_MS
        )
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  registerMessagePackHandler<{ runId: string }, unknown>(
    'agent:changes:get',
    async (args) => {
      try {
        return await getNativeWorker().request(
          'agent-changes/get-hydrated',
          { runId: args.runId },
          REQUEST_TIMEOUT_MS
        )
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  registerMessagePackHandler<{ runId: string; changeId: string }, unknown>(
    'agent:changes:diff-content',
    async (args) => {
      try {
        return await getNativeWorker().request(
          'agent-changes/diff-local',
          { runId: args.runId, changeId: args.changeId },
          REQUEST_TIMEOUT_MS
        )
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  registerMessagePackHandler<{ runId: string; changeId: string }, unknown>(
    'agent:changes:undo-file',
    async (args) => {
      try {
        // Get the change set to find the specific change
        const changeSet = await getNativeWorker().request<{
          success: boolean
          changeSet?: { changes: Array<Record<string, unknown>> }
          error?: string
        }>(
          'agent-changes/get-hydrated',
          { runId: args.runId },
          REQUEST_TIMEOUT_MS
        )

        if (!changeSet.success || !changeSet.changeSet) {
          return { success: false, error: changeSet.error ?? 'Change set not found' }
        }

        const change = changeSet.changeSet.changes.find((c) => c.id === args.changeId)
        if (!change) {
          return { success: false, error: 'Change not found' }
        }

        const result = await getNativeWorker().request(
          'agent-changes/rollback-local-change',
          { change },
          REQUEST_TIMEOUT_MS
        )

        return result
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  registerMessagePackHandler<{ runId: string }, unknown>(
    'agent:changes:undo-run',
    async (args) => {
      try {
        // Get the change set, then rollback each change in reverse order
        const changeSet = await getNativeWorker().request<{
          success: boolean
          changeSet?: {
            changes: Array<{
              id: string
              status: string
              filePath: string
            }>
          }
          error?: string
        }>(
          'agent-changes/get-hydrated',
          { runId: args.runId },
          REQUEST_TIMEOUT_MS
        )

        if (!changeSet.success || !changeSet.changeSet) {
          return { success: false, error: changeSet.error ?? 'Change set not found' }
        }

        const changes = [...changeSet.changeSet.changes].reverse()
        let revertedCount = 0
        let failureCount = 0
        const failures: Array<{ changeId: string; filePath: string; reason: string }> = []

        for (const change of changes) {
          if (change.status !== 'open') continue

          try {
            const rollbackResult = await getNativeWorker().request<{
              success: boolean
              reverted: boolean
              reason?: string
              error?: string
            }>(
              'agent-changes/rollback-local-change',
              { change },
              REQUEST_TIMEOUT_MS
            )

            if (rollbackResult.success && rollbackResult.reverted) {
              revertedCount++
            } else {
              failureCount++
              failures.push({
                changeId: change.id,
                filePath: change.filePath,
                reason: rollbackResult.reason ?? rollbackResult.error ?? 'Unknown error'
              })
            }
          } catch (err) {
            failureCount++
            failures.push({
              changeId: change.id,
              filePath: change.filePath,
              reason: err instanceof Error ? err.message : String(err)
            })
          }
        }

        return {
          success: failureCount === 0,
          revertedCount,
          failureCount,
          failures
        }
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    }
  )
}
