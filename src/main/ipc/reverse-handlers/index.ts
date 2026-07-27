/**
 * Central dispatch for all reverse-request handlers that run in the Main process.
 *
 * The native-agent-runtime calls `dispatchReverseRequest(method, params)` for
 * any method in the `mainProcessMethods` set. This module routes to the
 * appropriate handler module based on the method name prefix.
 */

import { handleCronReverseRequest } from './cron-reverse-handler'
import { handleImageGenerate } from './image-reverse-handler'
import { handleStubReverseRequest } from './stub-reverse-handler'
import { executeMcpToolFromMain, readMcpResourceFromMain } from '../mcp-handlers'
import {
  executePluginAction,
  executeChannelSpecificPluginTool,
  isPluginToolEnabled
} from '../channel-handlers'

type ReverseHandler = (params: Record<string, unknown>) => Promise<unknown>

// Direct method → handler mapping (no prefix matching needed)
const directHandlers = new Map<string, ReverseHandler>([
  ['image:generate', (p) => handleImageGenerate(p)],
  ['mcp:call-tool', (p) => executeMcpToolFromMain(p as { serverId: string; toolName: string; args: Record<string, unknown> })],
  ['mcp:read-resource', (p) => readMcpResourceFromMain(p as { serverId: string; uri?: string; resourceName?: string })],
])

// Channel-specific plugin methods — routed to real channel handlers
const channelPluginMethods = new Set([
  'plugin:feishu:send-image',
  'plugin:feishu:send-file',
  'plugin:feishu:list-members',
  'plugin:feishu:send-mention',
  'plugin:feishu:send-urgent',
  'plugin:feishu:bitable:list-apps',
  'plugin:feishu:bitable:list-tables',
  'plugin:feishu:bitable:list-fields',
  'plugin:feishu:bitable:get-records',
  'plugin:feishu:bitable:create-records',
  'plugin:feishu:bitable:update-records',
  'plugin:feishu:bitable:delete-records',
  'plugin:feishu:download-resource',
  'plugin:weixin:send-image',
  'plugin:weixin:send-file',
])

// Plugin action methods — routed to executePluginAction
const pluginActionMethods = new Set([
  'plugin:exec',
  'plugin:tool-enabled',
])

// Methods still dispatched to the stub handler (not yet implemented)
const stubMethods = new Set([
  'codegraph:tool',
  'extension:execute-js-tool',
  'team:send-message',
])

// Cron method prefix
const CRON_PREFIX = 'cron:'

// Notify is handled inline in native-agent-runtime (Electron Notification API)

/**
 * Check if a method is handled by the Main process reverse-request dispatch.
 */
export function isMainProcessMethod(method: string): boolean {
  return (
    directHandlers.has(method) ||
    channelPluginMethods.has(method) ||
    pluginActionMethods.has(method) ||
    stubMethods.has(method) ||
    method.startsWith(CRON_PREFIX) ||
    method === 'notify:desktop'
  )
}

/**
 * Dispatch a reverse-request to the appropriate Main process handler.
 * Returns the handler result (or throws on error).
 */
export async function dispatchReverseRequest(
  method: string,
  params: unknown
): Promise<unknown> {
  const args = (params as Record<string, unknown>) ?? {}

  // Direct mapping
  const direct = directHandlers.get(method)
  if (direct) {
    return await direct(args)
  }

  // Cron family
  if (method.startsWith(CRON_PREFIX)) {
    return await handleCronReverseRequest(method, args)
  }

  // Channel-specific plugin tools (feishu/weixin media, bitable, etc.)
  if (channelPluginMethods.has(method)) {
    return await executeChannelSpecificPluginTool(method, args)
  }

  // Plugin action dispatch (sendMessage, replyMessage, listGroups, etc.)
  if (method === 'plugin:exec') {
    return await executePluginAction({
      pluginId: args.pluginId as string,
      action: args.action as string,
      params: (args.params as Record<string, unknown>) ?? {}
    })
  }

  // Plugin tool enabled check
  if (method === 'plugin:tool-enabled') {
    const pluginId = args.pluginId as string
    const toolName = args.toolName as string
    const enabled = await isPluginToolEnabled(pluginId, toolName)
    return { enabled }
  }

  // Stub handlers (CodeGraph, Extension, Team)
  if (stubMethods.has(method)) {
    return await handleStubReverseRequest(method, args)
  }

  throw new Error(`Unknown reverse request method: ${method}`)
}
