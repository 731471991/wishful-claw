import { toolRegistry } from '../agent/tool-registry'
import type { ToolHandler } from '../tools/tool-types'

// ── 5 Unified Plugin Tools ──
// All provider-agnostic — route via plugin_id to the correct backend service


function nativeOnlyPluginResult(toolName: string): string {
  return JSON.stringify({
    error: `${toolName} executes in the .NET Native Worker and is unavailable through the renderer boundary.`
  })
}

const pluginSendMessage: ToolHandler = {
  definition: {
    name: 'PluginSendMessage',
    description:
      'Send a message to a chat/group via a messaging channel (Feishu, DingTalk, etc.). Requires approval.',
    inputSchema: {
      type: 'object',
      properties: {
        plugin_id: { type: 'string', description: 'The channel instance ID to use' },
        chat_id: { type: 'string', description: 'The chat/group ID to send the message to' },
        content: { type: 'string', description: 'The message content to send' }
      },
      required: ['plugin_id', 'chat_id', 'content']
    }
  },
  execute: async () => nativeOnlyPluginResult('PluginSendMessage'),
  requiresApproval: () => true
}

const pluginReplyMessage: ToolHandler = {
  definition: {
    name: 'PluginReplyMessage',
    description: 'Reply to a specific message via a messaging channel. Requires approval.',
    inputSchema: {
      type: 'object',
      properties: {
        plugin_id: { type: 'string', description: 'The channel instance ID to use' },
        message_id: { type: 'string', description: 'The message ID to reply to' },
        content: { type: 'string', description: 'The reply content' }
      },
      required: ['plugin_id', 'message_id', 'content']
    }
  },
  execute: async () => nativeOnlyPluginResult('PluginReplyMessage'),
  requiresApproval: () => true
}

const pluginGetGroupMessages: ToolHandler = {
  definition: {
    name: 'PluginGetGroupMessages',
    description: 'Get recent messages from a chat/group via a messaging channel.',
    inputSchema: {
      type: 'object',
      properties: {
        plugin_id: { type: 'string', description: 'The channel instance ID to use' },
        chat_id: { type: 'string', description: 'The chat/group ID to get messages from' },
        count: { type: 'number', description: 'Number of messages to retrieve (default 20)' }
      },
      required: ['plugin_id', 'chat_id']
    }
  },
  execute: async () => nativeOnlyPluginResult('PluginGetGroupMessages')
}

const pluginListGroups: ToolHandler = {
  definition: {
    name: 'PluginListGroups',
    description: 'List all available groups/chats for a messaging channel.',
    inputSchema: {
      type: 'object',
      properties: {
        plugin_id: { type: 'string', description: 'The channel instance ID to use' }
      },
      required: ['plugin_id']
    }
  },
  execute: async () => nativeOnlyPluginResult('PluginListGroups')
}

const pluginSummarizeGroup: ToolHandler = {
  definition: {
    name: 'PluginSummarizeGroup',
    description:
      'Get recent messages from a group and provide them for summarization. Returns raw messages — you should summarize them in your response.',
    inputSchema: {
      type: 'object',
      properties: {
        plugin_id: { type: 'string', description: 'The channel instance ID to use' },
        chat_id: { type: 'string', description: 'The chat/group ID to summarize' },
        count: {
          type: 'number',
          description: 'Number of recent messages to include (default 50)'
        }
      },
      required: ['plugin_id', 'chat_id']
    }
  },
  execute: async () => nativeOnlyPluginResult('PluginSummarizeGroup')
}

const pluginGetCurrentChatMessages: ToolHandler = {
  definition: {
    name: 'PluginGetCurrentChatMessages',
    description: 'Get recent messages from the current channel chat session.',
    inputSchema: {
      type: 'object',
      properties: {
        plugin_id: {
          type: 'string',
          description: 'The channel instance ID to use (optional, defaults to current)'
        },
        chat_id: {
          type: 'string',
          description: 'The chat/group ID to read (optional, defaults to current)'
        },
        count: { type: 'number', description: 'Number of messages to retrieve (default 20)' }
      },
      required: []
    }
  },
  execute: async () => nativeOnlyPluginResult('PluginGetCurrentChatMessages')
}

// ── Feishu-specific Media Tools ──

