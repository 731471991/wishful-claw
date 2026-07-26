import { getNativeWorker } from '../lib/native-worker'
import { registerMessagePackHandler } from './messagepack-handler'

type WebSearchProvider =
  | 'tavily'
  | 'searxng'
  | 'exa'
  | 'exa-mcp'
  | 'bocha'
  | 'zhipu'
  | 'google'
  | 'bing'
  | 'baidu'

interface WebSearchRequest {
  query: string
  provider: WebSearchProvider
  maxResults?: number
  searchMode?: 'web' | 'news'
  apiKey?: string
  timeout?: number
}

interface WebFetchRequest {
  url?: string
  urls?: string[] | string
  format?: 'markdown' | 'text' | 'html'
  timeout?: number
}

const WEB_SEARCH_PROVIDERS: WebSearchProvider[] = [
  'tavily',
  'searxng',
  'exa',
  'exa-mcp',
  'bocha',
  'zhipu',
  'google',
  'bing',
  'baidu'
]

function normalizeNativeResult<T>(value: unknown): T | { error: string } {
  if (typeof value !== 'string') return value as T
  try {
    return JSON.parse(value) as T
  } catch {
    return { error: value }
  }
}

async function requestNativeWeb<T>(
  method: 'web/search' | 'web/fetch',
  params: WebSearchRequest | WebFetchRequest
): Promise<T | { error: string }> {
  try {
    const result = await getNativeWorker().request<unknown>(method, params, 120_000)
    return normalizeNativeResult<T>(result)
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

export function registerWebSearchHandlers(): void {
  registerMessagePackHandler<WebSearchRequest>('web:search', (args) =>
    requestNativeWeb('web/search', args)
  )

  registerMessagePackHandler<WebFetchRequest>('web:fetch', (args) =>
    requestNativeWeb('web/fetch', args)
  )

  registerMessagePackHandler<undefined, { providers: WebSearchProvider[] }>(
    'web:search-config',
    async () => ({ providers: WEB_SEARCH_PROVIDERS })
  )

  registerMessagePackHandler<undefined, WebSearchProvider[]>(
    'web:search-providers',
    async () => WEB_SEARCH_PROVIDERS
  )
}
