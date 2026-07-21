/**
 * Export a session's messages as Markdown.
 * Placeholder implementation — returns basic text.
 * TODO (迭代八): Full markdown export with tool calls, thinking blocks, etc.
 */
export function exportSessionMarkdown(session: { title: string; messages: Array<{ role: string; text: string }> }): string {
  const lines: string[] = [`# ${session.title}`, '']
  for (const msg of session.messages) {
    lines.push(`## ${msg.role === 'user' ? 'User' : 'Assistant'}`, '')
    lines.push(msg.text || '(empty)')
    lines.push('')
  }
  return lines.join('\n')
}

/**
 * Export a session as a JSON snapshot.
 * TODO (迭代八): Full snapshot with metadata.
 */
export function exportSessionSnapshot(session: unknown): string {
  return JSON.stringify(
    { version: 1, type: 'session' as const, session },
    null,
    2
  )
}
