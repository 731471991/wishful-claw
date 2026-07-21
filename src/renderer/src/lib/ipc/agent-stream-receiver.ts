import type { AgentStreamEnvelope } from '@shared/agent-stream-protocol'
import { asAgentStreamEnvelope } from '@shared/messagepack/agent-stream-codec'

export type StreamEventHandler = (envelope: AgentStreamEnvelope) => void

/**
 * Receives agent stream events from the main process via IPC,
 * validates the envelope, and dispatches to registered handlers.
 */
export class AgentStreamReceiver {
  private handler: StreamEventHandler | null = null
  private unsubscribe: (() => void) | null = null

  start(handler: StreamEventHandler): void {
    this.handler = handler
    this.unsubscribe = window.api.onAgentStream((payload: unknown) => {
      const envelope = asAgentStreamEnvelope(payload)
      if (envelope && this.handler) {
        this.handler(envelope)
      }
    })
  }

  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
    this.handler = null
  }
}

/**
 * Singleton receiver for the renderer process.
 */
let _receiver: AgentStreamReceiver | null = null

export function getAgentStreamReceiver(): AgentStreamReceiver {
  if (!_receiver) {
    _receiver = new AgentStreamReceiver()
  }
  return _receiver
}
