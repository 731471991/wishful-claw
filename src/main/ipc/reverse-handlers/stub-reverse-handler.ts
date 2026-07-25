/**
 * Stub reverse-request handlers for features that require external
 * infrastructure not yet available in wishful-claw.
 *
 * Each handler returns a meaningful error message explaining what is
 * needed to enable the feature, rather than a generic "not implemented".
 */

// ── MCP (Model Context Protocol) ──

export async function handleMcpCallTool(params: Record<string, unknown>): Promise<unknown> {
  const serverId = params.serverId as string | undefined
  const toolName = params.toolName as string | undefined
  return {
    success: false,
    error: `MCP tool call (server=${serverId}, tool=${toolName}) failed: no MCP server manager configured. Install and configure MCP servers in Settings.`
  }
}

export async function handleMcpReadResource(params: Record<string, unknown>): Promise<unknown> {
  const serverId = params.serverId as string | undefined
  return {
    success: false,
    error: `MCP resource read (server=${serverId}) failed: no MCP server manager configured.`
  }
}

// ── CodeGraph ──

export async function handleCodeGraphTool(params: Record<string, unknown>): Promise<unknown> {
  const action = params.action as string | undefined
  return {
    success: false,
    error: `CodeGraph "${action}" failed: no code graph index available. Build a code graph first.`
  }
}

// ── Extension ──

export async function handleExtensionExecuteJsTool(params: Record<string, unknown>): Promise<unknown> {
  const toolName = params.toolName as string | undefined
  return {
    success: false,
    error: `Extension tool "${toolName}" failed: no extension runtime configured. Install extensions first.`
  }
}

// ── Plugin ──

export async function handlePluginExec(params: Record<string, unknown>): Promise<unknown> {
  return {
    success: false,
    error: 'Plugin execution failed: no plugin system configured. Install plugins first.'
  }
}

export async function handlePluginToolEnabled(params: Record<string, unknown>): Promise<unknown> {
  return {
    success: false,
    error: 'Plugin tool management failed: no plugin system configured.'
  }
}

// ── Channel: Feishu ──

const FEISHU_NOT_CONFIGURED =
  'Feishu integration is not configured. Set up Feishu app credentials in Settings first.'

export async function handleFeishuSendImage(): Promise<unknown> {
  return { success: false, error: FEISHU_NOT_CONFIGURED }
}

export async function handleFeishuSendFile(): Promise<unknown> {
  return { success: false, error: FEISHU_NOT_CONFIGURED }
}

export async function handleFeishuListMembers(): Promise<unknown> {
  return { success: false, error: FEISHU_NOT_CONFIGURED }
}

export async function handleFeishuSendMention(): Promise<unknown> {
  return { success: false, error: FEISHU_NOT_CONFIGURED }
}

export async function handleFeishuSendUrgent(): Promise<unknown> {
  return { success: false, error: FEISHU_NOT_CONFIGURED }
}

// ── Channel: Feishu Bitable ──

export async function handleFeishuBitableListApps(): Promise<unknown> {
  return { success: false, error: FEISHU_NOT_CONFIGURED }
}

export async function handleFeishuBitableListTables(): Promise<unknown> {
  return { success: false, error: FEISHU_NOT_CONFIGURED }
}

export async function handleFeishuBitableListFields(): Promise<unknown> {
  return { success: false, error: FEISHU_NOT_CONFIGURED }
}

export async function handleFeishuBitableGetRecords(): Promise<unknown> {
  return { success: false, error: FEISHU_NOT_CONFIGURED }
}

export async function handleFeishuBitableCreateRecords(): Promise<unknown> {
  return { success: false, error: FEISHU_NOT_CONFIGURED }
}

export async function handleFeishuBitableUpdateRecords(): Promise<unknown> {
  return { success: false, error: FEISHU_NOT_CONFIGURED }
}

export async function handleFeishuBitableDeleteRecords(): Promise<unknown> {
  return { success: false, error: FEISHU_NOT_CONFIGURED }
}

// ── Channel: WeChat ──

const WEIXIN_NOT_CONFIGURED =
  'WeChat integration is not configured. Set up WeChat credentials in Settings first.'

export async function handleWeixinSendImage(): Promise<unknown> {
  return { success: false, error: WEIXIN_NOT_CONFIGURED }
}

export async function handleWeixinSendFile(): Promise<unknown> {
  return { success: false, error: WEIXIN_NOT_CONFIGURED }
}

// ── Team ──

interface TeamMessage {
  id: string
  teamId: string
  fromMemberId: string
  toMemberId: string | null
  content: unknown
  createdAt: number
}

const teamMessages = new Map<string, TeamMessage[]>()
let teamMsgCounter = 0

export async function handleTeamSendMessage(params: Record<string, unknown>): Promise<unknown> {
  const teamId = params.teamId as string | undefined
  const fromMemberId = params.fromMemberId as string | undefined
  if (!teamId || !fromMemberId) {
    return { success: false, error: 'teamId and fromMemberId are required' }
  }

  teamMsgCounter += 1
  const msg: TeamMessage = {
    id: `msg-${Date.now().toString(36)}-${teamMsgCounter}`,
    teamId,
    fromMemberId,
    toMemberId: (params.toMemberId as string) ?? null,
    content: params.content ?? params.message ?? '',
    createdAt: Date.now()
  }

  const queue = teamMessages.get(teamId) ?? []
  queue.push(msg)
  teamMessages.set(teamId, queue)

  return { success: true, messageId: msg.id }
}

/** Dispatcher for all stub handlers */
export async function handleStubReverseRequest(
  method: string,
  params: unknown
): Promise<unknown> {
  const args = (params as Record<string, unknown>) ?? {}

  // MCP
  if (method === 'mcp:call-tool') return handleMcpCallTool(args)
  if (method === 'mcp:read-resource') return handleMcpReadResource(args)

  // CodeGraph
  if (method === 'codegraph:tool') return handleCodeGraphTool(args)

  // Extension
  if (method === 'extension:execute-js-tool') return handleExtensionExecuteJsTool(args)

  // Plugin
  if (method === 'plugin:exec') return handlePluginExec(args)
  if (method === 'plugin:tool-enabled') return handlePluginToolEnabled(args)

  // Feishu
  if (method === 'plugin:feishu:send-image') return handleFeishuSendImage()
  if (method === 'plugin:feishu:send-file') return handleFeishuSendFile()
  if (method === 'plugin:feishu:list-members') return handleFeishuListMembers()
  if (method === 'plugin:feishu:send-mention') return handleFeishuSendMention()
  if (method === 'plugin:feishu:send-urgent') return handleFeishuSendUrgent()
  if (method === 'plugin:feishu:bitable:list-apps') return handleFeishuBitableListApps()
  if (method === 'plugin:feishu:bitable:list-tables') return handleFeishuBitableListTables()
  if (method === 'plugin:feishu:bitable:list-fields') return handleFeishuBitableListFields()
  if (method === 'plugin:feishu:bitable:get-records') return handleFeishuBitableGetRecords()
  if (method === 'plugin:feishu:bitable:create-records') return handleFeishuBitableCreateRecords()
  if (method === 'plugin:feishu:bitable:update-records') return handleFeishuBitableUpdateRecords()
  if (method === 'plugin:feishu:bitable:delete-records') return handleFeishuBitableDeleteRecords()

  // WeChat
  if (method === 'plugin:weixin:send-image') return handleWeixinSendImage()
  if (method === 'plugin:weixin:send-file') return handleWeixinSendFile()

  // Team
  if (method === 'team:send-message') return handleTeamSendMessage(args)

  return { success: false, error: `Unknown method: ${method}` }
}
