import { useChatStore, type ChatMessage } from '@renderer/stores/chat-store'
import { AssistantMessage } from './AssistantMessage'
import { UserMessage } from './UserMessage'

export function MessageList() {
  const messages = useChatStore((s) => {
    const session = s.sessions.find((sess) => sess.id === s.activeSessionId)
    return session?.messages ?? []
  })

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium">Start a conversation</p>
          <p className="text-sm">Select a provider and model, then type a message below.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
      {messages.map((msg) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
    </div>
  )
}

function MessageItem({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return <UserMessage message={message} />
  }
  return <AssistantMessage message={message} />
}
