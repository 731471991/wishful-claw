import { BrowserWindow } from 'electron'
import { getNativeWorker } from '../lib/native-worker'
import { safeSendMessagePackToWindow } from '../window-ipc'
import {
  SIDECAR_RENDERER_TOOL_REQUEST_MSGPACK_CHANNEL,
  SIDECAR_RENDERER_TOOL_RESPONSE_MSGPACK_CHANNEL,
  decodeMessagePackPayload,
  encodeMessagePackPayload,
  toMessagePackChannel
} from '../../shared/messagepack/binary-ipc'
import { ipcMain } from 'electron'

const SIDECAR_RENDERER_REQUEST_TIMEOUT_MS = 60_000

type RendererToolRequest = {
  id?: number | string
  method?: string
  params?: unknown
}

type PendingRendererToolRequest = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const pendingRendererToolRequests = new Map<string, PendingRendererToolRequest>()

/**
 * Routes reverse-request events from the native worker to the renderer.
 * The renderer executes browser tool calls and sends back the result via
 * the SIDECAR_RENDERER_TOOL_RESPONSE_MSGPACK_CHANNEL IPC channel.
 */
export function registerNativeAgentRuntimeHandlers(): void {
  const worker = getNativeWorker()

  // Listen for agent/reverse-request events from the worker
  worker.onEvent('agent/reverse-request', (params: unknown) => {
    void handleReverseRequest(params as RendererToolRequest)
  })

  // Listen for agent/reverse-cancel events from the worker
  worker.onEvent('agent/reverse-cancel', (params: unknown) => {
    const request = params as RendererToolRequest
    const id = request?.id
    if (typeof id !== 'number' && typeof id !== 'string') return
    const pending = pendingRendererToolRequests.get(String(id))
    if (pending) {
      clearTimeout(pending.timer)
      pending.reject(new Error('Reverse request cancelled by worker'))
      pendingRendererToolRequests.delete(String(id))
    }
  })

  // Register IPC handler for renderer tool responses
  ipcMain.handle(
    toMessagePackChannel(SIDECAR_RENDERER_TOOL_RESPONSE_MSGPACK_CHANNEL),
    async (_event, bytes: Uint8Array) => {
      const payload = decodeMessagePackPayload<{
        requestId: string
        result?: unknown
        error?: string
      }>(bytes)
      return completeRendererToolResponse(payload)
    }
  )
}

async function handleReverseRequest(request: RendererToolRequest): Promise<void> {
  const id = request?.id
  const method = request?.method
  if ((typeof id !== 'number' && typeof id !== 'string') || typeof method !== 'string') {
    return
  }

  const targetWindow = BrowserWindow.getAllWindows()[0]
  if (!targetWindow) {
    await sendReverseResponse(id, undefined, 'No renderer window available')
    return
  }

  if (method === 'browser/tool-request') {
    const requestId = `sidecar-browser-tool-request-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

    try {
      const result = await new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
          pendingRendererToolRequests.delete(requestId)
          reject(new Error('Browser tool request timed out'))
        }, SIDECAR_RENDERER_REQUEST_TIMEOUT_MS)

        pendingRendererToolRequests.set(requestId, { resolve, reject, timer })

        const sent = safeSendMessagePackToWindow(
          targetWindow,
          SIDECAR_RENDERER_TOOL_REQUEST_MSGPACK_CHANNEL,
          {
            requestId,
            method,
            params: request.params
          }
        )

        if (!sent) {
          clearTimeout(timer)
          pendingRendererToolRequests.delete(requestId)
          reject(new Error('Failed to deliver browser tool request to renderer'))
        }
      })

      await sendReverseResponse(id, result, undefined)
    } catch (error) {
      await sendReverseResponse(
        id,
        undefined,
        error instanceof Error ? error.message : String(error)
      )
    }
  } else {
    await sendReverseResponse(id, undefined, `Unsupported reverse request method: ${method}`)
  }
}

function completeRendererToolResponse(payload: {
  requestId: string
  result?: unknown
  error?: string
}): { ok: boolean } {
  const pending = pendingRendererToolRequests.get(payload.requestId)
  if (!pending) return { ok: false }

  clearTimeout(pending.timer)
  pendingRendererToolRequests.delete(payload.requestId)

  if (payload.error) {
    pending.reject(new Error(payload.error))
  } else {
    pending.resolve(payload.result)
  }
  return { ok: true }
}

async function sendReverseResponse(
  id: number | string,
  result: unknown,
  error: string | undefined
): Promise<void> {
  await getNativeWorker()
    .request(
      'agent/reverse-response',
      {
        id,
        ...(typeof error === 'string' ? { error } : { result })
      },
      30_000
    )
    .catch((sendError) => {
      console.warn(
        `[NativeAgentRuntime] reverse response failed: ${
          sendError instanceof Error ? sendError.message : String(sendError)
        }`
      )
    })
}