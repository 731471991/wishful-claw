/**
 * Tool definition size budget — prevents HTTP 413 (request too large)
 * when too many tools (especially MCP tools with verbose schemas) are
 * sent to the LLM provider.
 *
 * trimToolDefinitionsForSize() applies progressive trimming:
 * 1. Truncate long descriptions
 * 2. Strip nested property descriptions from MCP tool schemas
 * 3. Drop MCP tools if still over budget (built-in tools stay)
 */

interface ToolDef {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

const MAX_DESCRIPTION_LENGTH = 300
const SIZE_BUDGET_BYTES = 48_000 // ~48KB for tool definitions
const MCP_PREFIX = 'mcp__'

function estimateJsonSize(tools: ToolDef[]): number {
  return JSON.stringify(tools).length
}

function truncateDescription(desc: string): string {
  if (desc.length <= MAX_DESCRIPTION_LENGTH) return desc
  return desc.slice(0, MAX_DESCRIPTION_LENGTH - 3) + '...'
}

/**
 * Strip verbose properties (descriptions, examples, $schema, title) from
 * a JSON Schema to reduce its serialized size. Only keeps type, properties,
 * required, enum, and items.
 */
function simplifySchema(schema: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const allowedKeys = new Set(['type', 'properties', 'required', 'enum', 'items', 'anyOf', 'oneOf', 'allOf', 'additionalProperties', 'minimum', 'maximum', 'default'])

  for (const key of Object.keys(schema)) {
    if (!allowedKeys.has(key)) continue
    const value = schema[key]
    if (key === 'properties' && value && typeof value === 'object') {
      const props: Record<string, unknown> = {}
      for (const [propName, propVal] of Object.entries(value as Record<string, unknown>)) {
        if (propVal && typeof propVal === 'object') {
          props[propName] = simplifySchema(propVal as Record<string, unknown>)
        } else {
          props[propName] = propVal
        }
      }
      result[key] = props
    } else if (key === 'items' && value && typeof value === 'object') {
      result[key] = simplifySchema(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }

  return result
}

export function trimToolDefinitionsForSize<T extends ToolDef>(tools: T[]): T[] {
  if (tools.length === 0) return tools

  // Phase 0: check if we're already within budget
  if (estimateJsonSize(tools) <= SIZE_BUDGET_BYTES) return tools

  // Phase 1: truncate all descriptions
  let trimmed: T[] = tools.map((t) => ({ ...t, description: truncateDescription(t.description) } as T))
  if (estimateJsonSize(trimmed) <= SIZE_BUDGET_BYTES) return trimmed

  // Phase 2: simplify MCP tool schemas (they tend to have the most verbose schemas)
  trimmed = trimmed.map((t) =>
    t.name.startsWith(MCP_PREFIX)
      ? { ...t, inputSchema: simplifySchema(t.inputSchema) } as T
      : t
  )
  if (estimateJsonSize(trimmed) <= SIZE_BUDGET_BYTES) return trimmed

  // Phase 3: simplify ALL tool schemas
  trimmed = trimmed.map((t) => ({ ...t, inputSchema: simplifySchema(t.inputSchema) } as T))
  if (estimateJsonSize(trimmed) <= SIZE_BUDGET_BYTES) return trimmed

  // Phase 4: drop MCP tools one by one (largest first) until within budget
  const mcpTools = trimmed.filter((t) => t.name.startsWith(MCP_PREFIX))
  const nonMcpTools = trimmed.filter((t) => !t.name.startsWith(MCP_PREFIX))

  // Sort MCP tools by size descending — drop the biggest ones first
  mcpTools.sort((a, b) => JSON.stringify(b).length - JSON.stringify(a).length)

  const keptMcp: T[] = []
  for (const tool of mcpTools) {
    const candidate = [...nonMcpTools, ...keptMcp, tool]
    if (estimateJsonSize(candidate) <= SIZE_BUDGET_BYTES) {
      keptMcp.push(tool)
    }
    // else: skip this tool (too large)
  }

  console.warn(
    `[trimToolDefinitions] Dropped ${mcpTools.length - keptMcp.length} MCP tools to fit size budget`
  )

  return [...nonMcpTools, ...keptMcp]
}
