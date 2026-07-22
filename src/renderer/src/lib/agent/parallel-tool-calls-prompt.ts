export function buildParallelToolCallsPrompt(): string {
  return [
    '<use_parallel_tool_calls>',
    'Before calling tools, briefly plan which operations are independent and should be batched together.',
    'For maximum efficiency, whenever you perform multiple independent operations, invoke all relevant tools simultaneously rather than sequentially.',
    'Prioritize parallel tool calls whenever possible. For example, when reading 3 files, run 3 tool calls in parallel to read all 3 files into context at the same time.',
    'When running multiple read-only operations such as directory listings, file reads, searches, or status checks, call them in parallel unless one result is required to choose the next operation.',
    'Err on the side of maximizing parallel tool calls rather than running too many tools sequentially.',
    '</use_parallel_tool_calls>'
  ].join('\n')
}
