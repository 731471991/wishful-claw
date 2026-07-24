export interface PromptOptimizerEvent {
  type: 'text' | 'result'
  content?: string
  options?: { title: string; focus: string; content: string }[]
}

export async function* optimizePrompt(
  _input: string,
  _providerConfig?: unknown,
  _language?: string
): AsyncGenerator<PromptOptimizerEvent> {
  // TODO: implement prompt optimization
  yield { type: 'text', content: _input }
  yield { type: 'result', options: [] }
}
