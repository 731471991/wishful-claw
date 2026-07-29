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

// ── Extraction script ──
// Unified script that tries multiple selector strategies per engine.
// Returns JSON string: { results: [...], diagnostics: { title, url, bodySnippet, rawItemCount } }

const EXTRACT_SCRIPT = `
(function() {
  var results = [];
  var diagnostics = {
    title: document.title,
    url: location.href,
    bodySnippet: (document.body ? document.body.innerText : '').slice(0, 500),
    allLinks: 0
  };

  // Count all links for diagnostics
  diagnostics.allLinks = document.querySelectorAll('a').length;

  // ── Strategy 1: Engine-specific selectors ──

  var engine = arguments[0] || 'bing';

  if (engine === 'bing') {
    // Standard Bing: #b_results > li.b_algo
    var items = document.querySelectorAll('#b_results > li.b_algo, #b_results .b_algo');
    items.forEach(function(item) {
      var titleEl = item.querySelector('h2 a, h2 a[href]');
      if (!titleEl) return;
      var url = titleEl.href;
      var title = titleEl.textContent.trim();
      var snippetEl = item.querySelector('.b_caption p, .b_lineclamp2, .b_lineclamp3, .b_lineclamp4, p');
      var snippet = snippetEl ? snippetEl.textContent.trim() : '';
      if (title && url) results.push({ title: title, url: url, snippet: snippet });
    });

    // Fallback: any h2 > a inside #b_results
    if (results.length === 0) {
      document.querySelectorAll('#b_results h2 a[href]').forEach(function(a) {
        results.push({ title: a.textContent.trim(), url: a.href, snippet: '' });
      });
    }
  }

  if (engine === 'baidu') {
    var items = document.querySelectorAll('.result.c-container, .c-container, .result');
    items.forEach(function(item) {
      var titleEl = item.querySelector('h3 a, .t a');
      if (!titleEl) return;
      var url = titleEl.href;
      var title = titleEl.textContent.trim();
      var snippetEl = item.querySelector('.c-abstract, [class*="content-right"], [class*="abstract"], span.content-right_8Zs40');
      var snippet = snippetEl ? snippetEl.textContent.trim() : '';
      if (title && url) results.push({ title: title, url: url, snippet: snippet });
    });

    // Fallback: any h3 > a
    if (results.length === 0) {
      document.querySelectorAll('h3 a[href]').forEach(function(a) {
        results.push({ title: a.textContent.trim(), url: a.href, snippet: '' });
      });
    }
  }

  if (engine === 'google') {
    var items = document.querySelectorAll('div.g, div[data-sokoban-container] div.g, .Gx5Zad');
    items.forEach(function(item) {
      var titleEl = item.querySelector('h3');
      var linkEl = item.querySelector('a[href]');
      if (!titleEl || !linkEl) return;
      var url = linkEl.href;
      var title = titleEl.textContent.trim();
      if (url.indexOf('google.com/search') > -1) return;
      var snippetEl = item.querySelector('[data-sncf], [style*="-webkit-line-clamp"], .VwiC3b, span.aCOpRe, .IsZvec');
      var snippet = snippetEl ? snippetEl.textContent.trim() : '';
      if (title && url) results.push({ title: title, url: url, snippet: snippet });
    });
  }

  // ── Strategy 2: Generic fallback for any engine ──
  // If engine-specific selectors found nothing, try a generic approach:
  // look for <a> tags inside <h2> or <h3> that point to external URLs
  if (results.length === 0) {
    document.querySelectorAll('h2 a[href], h3 a[href]').forEach(function(a) {
      var href = a.href;
      // Skip internal navigation links
      if (href.indexOf('bing.com') > -1 && href.indexOf('search') > -1) return;
      if (href.indexOf('baidu.com') > -1 && href.indexOf('s?') > -1) return;
      if (href.indexOf('google.com') > -1) return;
      if (href.indexOf('go.microsoft.com') > -1) return;
      var title = a.textContent.trim();
      if (title.length < 5) return;
      // Try to find snippet in parent or sibling
      var parent = a.closest('li, div.g, div.result, [class*="result"]');
      var snippet = '';
      if (parent) {
        var p = parent.querySelector('p, span, [class*="snippet"], [class*="abstract"], [class*="caption"]');
        snippet = p ? p.textContent.trim() : '';
      }
      results.push({ title: title, url: href, snippet: snippet });
    });
  }

  // Deduplicate by URL
  var seen = {};
  results = results.filter(function(r) {
    if (seen[r.url]) return false;
    seen[r.url] = true;
    return true;
  });

  return JSON.stringify({ results: results, diagnostics: diagnostics });
})()
`

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

async function navigateToSearch(
  url: string,
  ctx: ToolContext
): Promise<Electron.WebviewTag> {
  const { normalizeBrowserUrl } = await import('../app-plugin/browser-access')
  const normalizedUrl = normalizeBrowserUrl(url)

  // Open the browser panel
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

  // Wait for dynamic content rendering — search engines inject results via JS
  await new Promise((resolve) => setTimeout(resolve, 1500))

  return webview
}

interface ExtractOutput {
  results: SearchResultItem[]
  diagnostics: {
    title: string
    url: string
    bodySnippet: string
    allLinks: number
  }
}

async function extractResults(
  webview: Electron.WebviewTag,
  engine: SearchEngine,
  maxResults: number
): Promise<ExtractOutput> {
  const raw = await runWebviewCommand(webview, 'extract search results', (target) =>
    target.executeJavaScript(`${EXTRACT_SCRIPT}(${JSON.stringify(engine)})`)
  )
  const parsed = parseWebviewJson<ExtractOutput>(raw)
  return {
    results: (parsed.results ?? []).slice(0, maxResults),
    diagnostics: parsed.diagnostics ?? { title: '', url: '', bodySnippet: '', allLinks: 0 }
  }
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

    const requestedEngine = selectEngine(input.engine as string)
    const maxResults = Math.min((input.maxResults as number) ?? 10, 50)

    // Try the requested engine first, then fall back to others if no results
    const engineOrder: SearchEngine[] = [requestedEngine]
    for (const e of ['bing', 'baidu', 'google'] as SearchEngine[]) {
      if (!engineOrder.includes(e)) engineOrder.push(e)
    }

    let lastDiagnostics: ExtractOutput['diagnostics'] | null = null

    try {
      for (const engine of engineOrder) {
        const searchUrl = buildSearchUrl(engine, query, maxResults)
        const webview = await navigateToSearch(searchUrl, ctx)
        const { results, diagnostics } = await extractResults(webview, engine, maxResults)
        lastDiagnostics = diagnostics

        if (results.length > 0) {
          return encodeStructuredToolResult({
            engine: ENGINE_CONFIG[engine].label,
            query,
            results,
            count: results.length
          })
        }

        // No results from this engine, try next (unless it was the last one)
        console.warn(`[BrowserSearch] ${engine} returned 0 results. Diagnostics:`, diagnostics)
      }

      // All engines returned 0 results
      return encodeStructuredToolResult({
        engine: ENGINE_CONFIG[requestedEngine].label,
        query,
        results: [],
        count: 0,
        message: 'No organic results extracted from any search engine.',
        diagnostics: lastDiagnostics ? {
          pageTitle: lastDiagnostics.title,
          pageUrl: lastDiagnostics.url,
          linkCount: lastDiagnostics.allLinks,
          bodyPreview: lastDiagnostics.bodySnippet.slice(0, 300)
        } : null
      })
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
