import { BrowserWindow } from 'electron'
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

/**
 * Fetch a URL using a hidden BrowserWindow so JavaScript can render.
 * Used for search engines that block plain HTTP (Baidu CAPTCHA) or
 * require JS rendering (GitHub, Brave, etc.).
 *
 * Timeout: loadURL gets 15s (did-finish-loading or did-fail-load),
 * then waitMs for JS rendering, then extract HTML. Total capped at ~20s
 * so it never blows the 60s browser/tool-request budget.
 */
async function fetchRenderedPage(url: string, waitMs: number): Promise<{ content?: string; error?: string }> {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: { sandbox: false, contextIsolation: false }
  })

  try {
    // Race loadURL against a 15s timeout — don't let a hanging page
    // (e.g. captcha redirect that never fires did-finish-loading) block
    // the entire search.
    const loadTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Page load timed out after 15s')), 15_000)
    )
    await Promise.race([
      win.loadURL(url, {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }),
      loadTimeout
    ])

    // Give JS time to render results
    await new Promise((resolve) => setTimeout(resolve, waitMs))

    const html = await win.webContents.executeJavaScript('document.documentElement.outerHTML')
    return { content: html }
  } catch (err) {
    // Even on load failure, try to grab whatever HTML is there —
    // some engines redirect mid-load but still have usable DOM.
    try {
      const html = await win.webContents.executeJavaScript('document.documentElement.outerHTML')
      if (html && html.length > 500) {
        return { content: html }
      }
    } catch {
      // DOM not ready, fall through to error
    }
    return { error: err instanceof Error ? err.message : String(err) }
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

export function registerWebSearchHandlers(): void {
  registerMessagePackHandler<WebSearchRequest>('web:search', (args) =>
    requestNativeWeb('web/search', args)
  )

  registerMessagePackHandler<WebFetchRequest>('web:fetch', (args) =>
    requestNativeWeb('web/fetch', args)
  )

  // Browser-rendered fetch for engines that need JS execution
  registerMessagePackHandler<{ url: string; waitMs?: number }>(
    'web:fetch-rendered',
    async (args) => fetchRenderedPage(args.url, args.waitMs ?? 3000)
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
