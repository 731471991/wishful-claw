export function isMcpTool(_name: string): boolean {
  return false
}

export function parseMcpToolName(name: string): { server: string; tool: string } | null {
  const parts = name.split('__')
  if (parts.length >= 2) {
    return { server: parts[0], tool: parts.slice(1).join('__') }
  }
  return null
}
