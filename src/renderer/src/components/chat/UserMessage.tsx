import type { ChatMessage } from '@renderer/stores/chat-store'

export function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl bg-primary px-4 py-2 text-primary-foreground">
        <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>
      </div>
    </div>
  )
}
