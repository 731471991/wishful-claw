import { useEffect } from 'react'
import { MessageList } from './MessageList'
import { InputArea } from './InputArea'
import { ActivityPanel } from '../activity/ActivityPanel'
import { useChatStore } from '@renderer/stores/chat-store'
import { useActivityStore } from '@renderer/stores/activity-store'
import { getAgentStreamReceiver } from '@renderer/lib/ipc/agent-stream-receiver'

export function ChatPage() {
  const activities = useActivityStore((s) => s.activities)

  // Ensure stream receiver is started and dispatches to both stores
  useEffect(() => {
    const receiver = getAgentStreamReceiver()
    receiver.start((envelope) => {
      useChatStore.getState().handleEnvelope(envelope)
      useActivityStore.getState().handleEnvelope(envelope)
    })
    return () => receiver.stop()
  }, [])

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left: Chat area */}
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex-1 overflow-y-auto">
          <MessageList />
        </div>
        <InputArea />
      </div>

      {/* Right: Activity panel (collapsible) */}
      {activities.length > 0 && <ActivityPanel />}
    </div>
  )
}
