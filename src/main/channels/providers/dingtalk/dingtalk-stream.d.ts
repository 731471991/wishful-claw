declare module 'dingtalk-stream' {
  export type EventAckStatus = string
  export class EventAck {
    static SUCCESS: EventAckStatus
    static FAILED: EventAckStatus
    status: EventAckStatus
  }
  export interface DWClientDownStream {
    headers: {
      messageId: string
      topic: string
      [key: string]: unknown
    }
    data: string | unknown
    [key: string]: unknown
  }
  export class DWClient {
    constructor(options: Record<string, unknown>)
    registerAllEventListener(callback: (msg: DWClientDownStream) => unknown): void
    registerCallbackListener(topic: string, callback: (msg: DWClientDownStream) => void): void
    send(messageId: string, data: unknown): void
    connect(): Promise<void>
    disconnect(): void
  }
  export const TOPIC_ROBOT: string
}
