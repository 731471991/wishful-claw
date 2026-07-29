import { toolRegistry } from '../agent/tool-registry'
import { useUIStore } from '../../stores/ui-store'
import { encodeStructuredToolResult, encodeToolError } from './tool-result-format'
import type { ToolHandler, ToolContext } from './tool-types'
import {
  waitForWebview,
  waitForLoad,
  runWebviewCommand,
  parseWebviewJson
} from './browser-webview-helpers'

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

// ── Extraction scripts ──
// Each script runs in the page context and returns a JSON string of SearchResultItem[].

const BING_EXTRACT = `
(function() {
  var results = [];
  var items = document.querySelectorAll('#b_results > li.b_algo');
  items.forEach(function(item) {
    var titleEl = item.querySelector('h2 a');
    if (!titleEl) return;
    var url = titleEl.href;
    var title = titleEl.textContent.trim();
    var snippetEl = item.querySelector('.b_caption p, .b_lineclamp2, .b_lineclamp3, .b_lineclamp4');
    var snippet = snippetEl ? snippetEl.textContent.trim() : '';
    if (title && url) {
      results.push({ title: title, url: url, snippet: snippet });
    }
  });
  return JSON.stringify(results);
})()
`

const BAIDU_EXTRACT = `
(function() {
  var results = [];
  var items = document.querySelectorAll('.result.c-container, .c-container');
  items.forEach(function(item) {
    var titleEl = item.querySelector('h3 a');
    if (!titleEl) return;
    var url = titleEl.href;
    var title = titleEl.textContent.trim();
    var snippetEl = item.querySelector('.c-abstract, [class*="content-right"]');
    var snippet = snippetEl ? snippetEl.textContent.trim() : '';
    if (title && url) {
      results.push({ title: title, url: url, snippet: snippet });
    }
  });
  return JSON.stringify(results);
})()
`

const GOOGLE_EXTRACT = `
(function() {
  var results = [];
  var items = document.querySelectorAll('div.g, div[data-sokoban-container] div.g');
  items.forEach(function(item) {
    var titleEl = item.querySelector('h3');
    var linkEl = item.querySelector('a[href]');
    if (!titleEl || !linkEl) return;
    var url = linkEl.href;
    var title = titleEl.textContent.trim();
    if (url.startsWith('https://www.google.com/search')) return;
    var snippetEl = item.querySelector('[data-sncf], [style*="-webkit-line-clamp"], .VwiC3b, span.aCOpRe');
    var snippet = snippetEl ? snippetEl.textContent.trim() : '';
    if (title && url) {
      results.push({ title: title, url: url, snippet: snippet });
    }
  });
  return JSON.stringify(results);
})()
`

const EXTRACT_SCRIPTS: Record<SearchEngine, string> = {
  bing: BING_EXTRACT,
  baidu: BAIDU_EXTRACT,
  google: GOOGLE_EXTRACT
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
  // Default to Bing — best balance of coverage and scrape-friendliness
  return 'bing'
}

async function navigateToSearch(
  url: string,
  ctx: ToolContext
): Promise<Electron.WebviewTag> {
  const { normalizeBrowserUrl } = await import('../app-plugin/browser-access')
  const normalizedUrl = normalizeBrowserUrl(url)

  // Open the browser panel so the user can see the search happening
  useUIStore.getState().openBrowserTab(normalizedUrl, ctx.sessionId)

  const webview = await waitForWebview(ctx, 10000)
  if (!webview) {
    throw new Error('Browser panel did not attach in time.')
  }

  const loadPromise = waitForLoad(webview, 20000)
  await runWebviewCommand(webview, 'navigate to search engine', (target) => {
    target.src = normalizedUrl
  })
  await loadPromise

  // Brief delay for dynamic content rendering (Bing/Google inject results via JS)
  await new Promise((resolve) => setTimeout(resolve, 800))

  return webview
}

async function extractResults(
  webview: Electron.WebviewTag,
  engine: SearchEngine,
  maxResults: number
): Promise<SearchResultItem[]> {
  const script = EXTRACT_SCRIPTS[engine]
  const raw = await runWebviewCommand(webview, 'extract search results', (target) =>
    target.executeJavaScript(script)
  )
  const parsed = parseWebviewJson<SearchResultItem[]>(raw)
  return parsed.slice(0, maxResults)
}

// ── Tool handler ──

const browserSearchHandler: ToolHandler = {
  definition: {
    name: 'BrowserSearch',
    description: [
      'Search the web using the built-in browser (Chromium webview).',
      '',
      'Navigates to the selected search engine (Bing, Baidu, or Google),',
      'extracts organic results with title, URL, and snippet.',
      '',
      'No API key required — uses the embedded browser directly.',
      '',
      'Returns structured results (title, URL, snippet) that you can',
      'directly summarize and present to the user. For most queries the',
      'snippets contain enough information — no need to open each page.',
      '',
      'If you need the full content of a specific result page, use',
      'BrowserNavigate + BrowserGetContent on its URL.',
      '',
      'Engines:',
      '- "bing" (default): Best for general international search',
      '- "baidu": Best for Chinese-language content',
      '- "google": Most comprehensive, but may show CAPTCHA'
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
  execute: async (input, ctx) => {
    const query = (input.query as string)?.trim()
    if (!query) {
      return encodeToolError('query is required')
    }

    const engine = selectEngine(input.engine as string)
    const maxResults = Math.min((input.maxResults as number) ?? 10, 50)

    try {
      const searchUrl = buildSearchUrl(engine, query, maxResults)
      const webview = await navigateToSearch(searchUrl, ctx)
      const results = await extractResults(webview, engine, maxResults)

      const response = {
        engine: ENGINE_CONFIG[engine].label,
        query,
        results,
        count: results.length
      }

      if (results.length === 0) {
        return encodeStructuredToolResult({
          ...response,
          message: 'No organic results extracted. The search engine may have returned a CAPTCHA or the page structure changed. Try a different engine.'
        })
      }

      return encodeStructuredToolResult(response)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return encodeToolError(`Browser search failed: ${message}`)
    }
  },
  requiresApproval: () => false
}

// ── Registration ──

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
