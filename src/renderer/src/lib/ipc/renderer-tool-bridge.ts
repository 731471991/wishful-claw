import { handleNativeBrowserToolRequest } from '@renderer/lib/tools/browser-native-ui'
import { handleNativeAskUserRequest } from '@renderer/lib/tools/ask-user-tool'
import { decodeIpcMessagePack, invokeMessagePack } from '@renderer/lib/ipc/messagepack-ipc-client'
import {
  SIDECAR_RENDERER_TOOL_REQUEST_MSGPACK_CHANNEL,
  SIDECAR_RENDERER_TOOL_RESPONSE_MSGPACK_CHANNEL
} from '../../../../shared/messagepack/binary-ipc'

// Native AgentRuntime owns the loop and tool execution. This bridge is only
// for renderer/UI boundaries that cannot live inside the native worker.

type RendererToolRequestPayload = { requestId: string; method: string; params: unknown }
type RendererToolResponsePayload = { requestId: string; result?: unknown; error?: string }

type RendererToolBridgeWindow = Window & {
  __wishfulClawRendererToolBridgeCleanup?: () => void
}

function getBridgeWindow(): RendererToolBridgeWindow {
  return window as RendererToolBridgeWindow
}

async function sendRendererToolResponse(response: RendererToolResponsePayload): Promise<void> {
  await invokeMessagePack(SIDECAR_RENDERER_TOOL_RESPONSE_MSGPACK_CHANNEL, response)
}

async function handleRendererToolRequest(payload: RendererToolRequestPayload): Promise<void> {
  if (!payload?.requestId) return

  try {
    if (payload.method === 'browser/tool-request') {
      await sendRendererToolResponse({
        requestId: payload.requestId,
        result: await handleNativeBrowserToolRequest(payload.params)
      })
      return
    }

    if (payload.method === 'ask-user/request') {
      await sendRendererToolResponse({
        requestId: payload.requestId,
        result: await handleNativeAskUserRequest(payload.params)
      })
      return
    }
  } catch (error) {
    await sendRendererToolResponse({
      requestId: payload.requestId,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

export function attachRendererToolBridge(): void {
  const bridgeWindow = getBridgeWindow()
  bridgeWindow.__wishfulClawRendererToolBridgeCleanup?.()
  bridgeWindow.__wishfulClawRendererToolBridgeCleanup = undefined
  window.electron.ipcRenderer.removeAllListeners(SIDECAR_RENDERER_TOOL_REQUEST_MSGPACK_CHANNEL)

  const msgpackCleanup = window.electron.ipcRenderer.on(
    SIDECAR_RENDERER_TOOL_REQUEST_MSGPACK_CHANNEL,
    async (_event: unknown, bytes: ArrayBuffer | ArrayBufferView) => {
      await handleRendererToolRequest(decodeIpcMessagePack<RendererToolRequestPayload>(bytes))
    }
  )
  bridgeWindow.__wishfulClawRendererToolBridgeCleanup = () => {
    msgpackCleanup()
  }
}