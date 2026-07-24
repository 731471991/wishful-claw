import { toolRegistry } from '../agent/tool-registry'
import { encodeStructuredToolResult } from './tool-result-format'
import type { ToolHandler } from './tool-types'

function nativeOnlyResult(toolName: string): string {
  return encodeStructuredToolResult({
    error: `${toolName} execution has migrated to .NET Native Worker.`
  })
}

const hotReadHandler: ToolHandler = {
  definition: {
    name: 'memory_hot_read',
    description:
      'Read the full hot memory (MEMORY.md). Returns all sections with their content. ' +
      'Hot memory contains the most important, always-loaded context.',
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          description: "Scope: 'global' or 'project'. Defaults to current project."
        }
      },
      required: []
    }
  },
  execute: async () => nativeOnlyResult('memory_hot_read'),
  requiresApproval: () => false
}

const hotWriteHandler: ToolHandler = {
  definition: {
    name: 'memory_hot_write',
    description:
      'Write, update, or delete a section in hot memory (MEMORY.md). ' +
      'Set content to empty string to delete the section.',
    inputSchema: {
      type: 'object',
      properties: {
        section: {
          type: 'string',
          description: 'Section title (the ## heading in MEMORY.md)'
        },
        content: {
          type: 'string',
          description: 'Markdown content for the section. Empty string to delete.'
        },
        scope: {
          type: 'string',
          description: "Scope: 'global' or 'project'. Defaults to current project."
        }
      },
      required: ['section']
    }
  },
  execute: async () => nativeOnlyResult('memory_hot_write'),
  requiresApproval: () => false
}

const appendHandler: ToolHandler = {
  definition: {
    name: 'memory_append',
    description:
      'Append a new memory entry to the database. ' +
      'Returns the entry id for future updates via memory_update.',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The memory entry to append. Markdown text.'
        },
        title: {
          type: 'string',
          description: 'Short title for the memory entry. Auto-generated if omitted.'
        },
        priority: {
          type: 'string',
          enum: ['permanent', 'lasting', 'standard', 'ephemeral'],
          default: 'standard',
          description: 'Memory priority level'
        },
        scope: {
          type: 'string',
          description: "Memory scope: 'global' or 'project'. Defaults to current project."
        }
      },
      required: ['content']
    }
  },
  execute: async () => nativeOnlyResult('memory_append'),
  requiresApproval: () => false
}

const updateHandler: ToolHandler = {
  definition: {
    name: 'memory_update',
    description:
      'Update a memory entry in the database by id. Can update content, priority, or mark as deprecated.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'The memory entry id (from memory_search results)'
        },
        content: {
          type: 'string',
          description: 'New content. Omit to keep existing.'
        },
        priority: {
          type: 'string',
          enum: ['permanent', 'lasting', 'standard', 'ephemeral'],
          description: 'New priority. Omit to keep existing.'
        },
        status: {
          type: 'string',
          enum: ['active', 'deprecated'],
          description: "New status. Use 'deprecated' to mark as outdated."
        }
      },
      required: ['id']
    }
  },
  execute: async () => nativeOnlyResult('memory_update'),
  requiresApproval: () => false
}

const searchHandler: ToolHandler = {
  definition: {
    name: 'memory_search',
    description:
      'Search memory entries in the database by keyword. ' +
      'Results include entry id — use memory_update to modify entries.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query'
        },
        scope: {
          type: 'string',
          description: "Scope filter: 'global', 'project', or omit to search all"
        },
        include_deprecated: {
          type: 'boolean',
          default: false,
          description: 'Include deprecated entries in results'
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return',
          default: 10,
          minimum: 1,
          maximum: 50
        }
      },
      required: ['query']
    }
  },
  execute: async () => nativeOnlyResult('memory_search'),
  requiresApproval: () => false
}

export function registerMemoryTools(): void {
  toolRegistry.register(hotReadHandler)
  toolRegistry.register(hotWriteHandler)
  toolRegistry.register(appendHandler)
  toolRegistry.register(updateHandler)
  toolRegistry.register(searchHandler)
}
