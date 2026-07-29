import { toolRegistry } from '../agent/tool-registry'
import { encodeStructuredToolResult, encodeToolError } from './tool-result-format'
import type { ToolHandler, ToolContext } from './tool-types'
import type { ToolResultContent } from '../api/types'

// ── Types ──

interface SearchResultItem {
  title: string
  url: string
  snippet: string
}

type SearchEngine = 'bing' | 'baidu' | 'google'

// ── Engine configurations ──

const ENGINE_CONFIG: Record<SearchEngine, { url: string; label: string }> = {
  bing: {
    url: 'https://www.bing.com/search?q=QUERY&count=NUM',
    label: 'Bing'
  },
  baidu: {
    url: 'https://www.baidu.com/s?wd=QUERY&rn=NUM',
    label: 'Baidu'
  },
  google: {
    url: 'https://www.google.com/search?q=QUERY&num=NUM',
    label: 'Google'
  }
}

// ── Helpers ──

function buildSearchUrl(engine: SearchEngine, query: string, maxResults: number): string {
  const config = ENGINE_CONFIG[engine]
  const encodedQuery = encodeURIComponent(query)
  return config.url
    .replace('QUERY', encodedQuery)
    .replace('NUM', String(Math.min(maxResults, 50)))
}

function selectEngine(inputEngine?: string): SearchEngine {
  const normalized = (inputEngine ?? '').toLowerCase().trim()
  if (normalized === 'baidu') return 'baidu'
  if (normalized === 'google') return 'google'
  return 'bing'
}

/**
 * Extract search results from a parsed HTML Document.
 * Tries engine-specific selectors first, then falls back to generic
 * h2/h3 link detection.
 */
function extractFromDocument(
  doc: Document,
  engine: SearchEngine,
  maxResults: number
): SearchResultItem[] {
  const results: SearchResultItem[] = []

  // ── Engine-specific selectors ──

  if (engine === 'bing') {
    doc.querySelectorAll('#b_results > li.b_algo, #b_results .b_algo').forEach((item) => {
      const titleEl = item.querySelector('h2 a[href]')
      if (!titleEl) return
      const url = (titleEl as HTMLAnchorElement).href
      const title = titleEl.textContent?.trim() ?? ''
      const snippetEl = item.querySelector('.b_caption p, .b_lineclamp2, .b_lineclamp3, .b_lineclamp4, p')
      const snippet = snippetEl?.textContent?.trim() ?? ''
      if (title && url) results.push({ title, url, snippet })
    })
  }

  if (engine === 'baidu') {
    doc.querySelectorAll('.result.c-container, .c-container, .result').forEach((item) => {
      const titleEl = item.querySelector('h3 a, .t a')
      if (!titleEl) return
      const url = (titleEl as HTMLAnchorElement).href
      const title = titleEl.textContent?.trim() ?? ''
      const snippetEl = item.querySelector('.c-abstract, [class*="content-right"], [class*="abstract"]')
      const snippet = snippetEl?.textContent?.trim() ?? ''
      if (title && url) results.push({ title, url, snippet })
    })
  }

  if (engine === 'google') {
    doc.querySelectorAll('div.g, .Gx5Zad').forEach((item) => {
      const titleEl = item.querySelector('h3')
      const linkEl = item.querySelector('a[href]')
      if (!titleEl || !linkEl) return
      const url = (linkEl as HTMLAnchorElement).href
      if (url.includes('google.com/search')) return
      const title = titleEl.textContent?.trim() ?? ''
      const snippetEl = item.querySelector('[data-sncf], .VwiC3b, span.aCOpRe, .IsZvec')
      const snippet = snippetEl?.textContent?.trim() ?? ''
      if (title && url) results.push({ title, url, snippet })
    })
  }

  // ── Generic fallback: any h2/h3 > a[href] pointing to external URLs ──

  if (results.length === 0) {
    doc.querySelectorAll('h2 a[href], h3 a[href]').forEach((a) => {
      const anchor = a as HTMLAnchorElement
      const href = anchor.href
      // Skip internal navigation links
      if (href.includes('bing.com') && href.includes('search')) return
      if (href.includes('baidu.com') && href.includes('s?')) return
      if (href.includes('google.com')) return
      if (href.includes('go.microsoft.com')) return
      const title = anchor.textContent?.trim() ?? ''
      if (title.length < 5) return
      // Try to find snippet in parent container
      const parent = anchor.closest('li, div.g, div.result, [class*="result"]')
      const snippetEl = parent?.querySelector('p, span, [class*="snippet"], [class*="abstract"], [class*="caption"]')
      const snippet = snippetEl?.textContent?.trim() ?? ''
      results.push({ title, url: href, snippet })
    })
  }

  // Deduplicate by URL
  const seen = new Set<string>()
  const deduped = results.filter((r) => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })

  return deduped.slice(0, maxResults)
}

// ── Core search execution ──

/**
 * Fetch search engine HTML via web:fetch IPC, parse with DOMParser,
 * extract results. No webview required — runs entirely headless.
 */
export async function executeBrowserSearch(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResultContent> {
  const query = (input.query as string)?.trim()
  if (!query) {
    return encodeToolError('query is required')
  }

  const engine = selectEngine(input.engine as string)
  const maxResults = Math.min((input.maxResults as number) ?? 10, 50)
  const searchUrl = buildSearchUrl(engine, query, maxResults)

  try {
    // Use web:fetch IPC — goes to .NET Worker which does a proper HTTP
    // request with browser User-Agent. No webview needed.
    const fetchResult = await ctx.ipc.invoke('web:fetch', {
      url: searchUrl,
      format: 'html',
      timeout: 15000
    }) as { content?: string; error?: string }

    if (fetchResult.error) {
      return encodeStructuredToolResult({
        engine: ENGINE_CONFIG[engine].label,
        query,
        results: [],
        count: 0,
        message: `Search engine request failed: ${fetchResult.error}`
      })
    }

    const html = fetchResult.content ?? ''
    if (!html) {
      return encodeStructuredToolResult({
        engine: ENGINE_CONFIG[engine].label,
        query,
        results: [],
        count: 0,
        message: 'Search engine returned empty response.'
      })
    }

    // Parse HTML with DOMParser (available in Electron renderer)
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const results = extractFromDocument(doc, engine, maxResults)

    if (results.length === 0) {
      // Include diagnostic info for debugging
      const bodyText = doc.body?.textContent?.slice(0, 300) ?? ''
      return encodeStructuredToolResult({
        engine: ENGINE_CONFIG[engine].label,
        query,
        results: [],
        count: 0,
        message: 'No organic results could be extracted from the search page.',
        diagnostics: {
          pageTitle: doc.title,
          pageUrl: searchUrl,
          linkCount: doc.querySelectorAll('a').length,
          bodyPreview: bodyText
        }
      })
    }

    return encodeStructuredToolResult({
      engine: ENGINE_CONFIG[engine].label,
      query,
      results,
      count: results.length
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return encodeToolError(`Search failed: ${message}`)
  }
}

// ── Tool definition & registration ──

const browserSearchHandler: ToolHandler = {
  definition: {
    name: 'BrowserSearch',
    description: [
      'Search the web and return structured results (title, URL, snippet).',
      '',
      'Uses direct HTTP requests — no API key, no browser panel.',
      'Results are returned immediately for you to summarize to the user.',
      'For most queries the snippets contain enough information.',
      '',
      'Engines:',
      '- "bing" (default): Best for general international search',
      '- "baidu": Best for Chinese-language content',
      '- "google": Most comprehensive, but may be blocked in some regions',
      '',
      'To read the full content of a result page, use WebFetch with its URL.'
    ].join('\n'),
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query'
        },
        engine: {
          type: 'string',
          description: 'Search engine to use',
          enum: ['bing', 'baidu', 'google'],
          default: 'bing'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return. Default 10.',
          default: 10
        }
      },
      required: ['query']
    }
  },
  execute: executeBrowserSearch,
  requiresApproval: () => false
}

let _registered = false

export function registerBrowserSearchTool(): void {
  if (_registered) return
  _registered = true
  toolRegistry.register(browserSearchHandler)
}

export function unregisterBrowserSearchTool(): void {
  if (!_registered) return
  _registered = false
  toolRegistry.unregister(browserSearchHandler.definition.name)
}

export function isBrowserSearchToolRegistered(): boolean {
  return _registered
}
