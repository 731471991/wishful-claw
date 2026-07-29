import { toolRegistry } from '../agent/tool-registry'
import { encodeStructuredToolResult, encodeToolError } from './tool-result-format'
import type { ToolHandler, ToolContext } from './tool-types'
import type { ToolResultContent } from '../api/types'

// ── Types ──

interface SearchResultItem {
  title: string
  url: string
  snippet: string
  source_engine: string
}

interface EngineConfig {
  name: string
  searchUrl: string
  type: string
  timeout: number
  /** Base URL for resolving relative links in search results */
  baseUrl?: string
  /** Special extraction mode for non-DOM engines */
  extractor?: 'dom' | 'toutiao_ssr' | 'xml'
  /** Fetch method: 'http' for plain HTTP, 'rendered' for headless browser */
  renderMode?: 'http' | 'rendered'
  /** Wait time after page load for rendered mode (ms) */
  renderWaitMs?: number
}

interface IntentConfig {
  engines: string[]
  maxConcurrent: number
}

// ── Engine configurations ──
// Mixed fetch strategy: 'http' for plain HTTP, 'rendered' for headless browser.
// Engines that block non-browser requests or need JS rendering use 'rendered'.

const ENGINES: Record<string, EngineConfig> = {
  // ── Chinese general ──
  baidu: {
    name: '百度',
    searchUrl: 'https://www.baidu.com/s?wd={query}&rn=10',
    type: 'general',
    timeout: 15000,
    extractor: 'dom',
    renderMode: 'rendered',
    renderWaitMs: 3000
  },
  bing_cn: {
    name: '必应中文',
    searchUrl: 'https://cn.bing.com/search?q={query}&ensearch=0',
    type: 'general',
    timeout: 10000,
    extractor: 'dom'
  },
  sogou: {
    name: '搜狗',
    searchUrl: 'https://www.sogou.com/web?query={query}',
    type: 'general',
    timeout: 10000,
    baseUrl: 'https://www.sogou.com',
    extractor: 'dom'
  },
  so_360: {
    name: '360搜索',
    searchUrl: 'https://m.so.com/s?q={query}',
    type: 'general',
    timeout: 10000,
    extractor: 'dom'
  },
  toutiao: {
    name: '头条搜索',
    searchUrl: 'https://so.toutiao.com/search?keyword={query}',
    type: 'general',
    timeout: 10000,
    baseUrl: 'https://so.toutiao.com',
    extractor: 'toutiao_ssr'
  },

  // ── International ──
  bing_intl: {
    name: '必应国际',
    searchUrl: 'https://www.bing.com/search?q={query}',
    type: 'general',
    timeout: 10000,
    extractor: 'dom'
  },

  // ── Tech (requires browser rendering) ──
  github: {
    name: 'GitHub',
    searchUrl: 'https://github.com/search?q={query}&type=repositories',
    type: 'tech',
    timeout: 15000,
    extractor: 'dom',
    renderMode: 'rendered',
    renderWaitMs: 4000
  },

  // ── Social / WeChat ──
  sogou_wechat: {
    name: '搜狗微信',
    searchUrl: 'https://weixin.sogou.com/weixin?type=2&query={query}&page=1',
    type: 'social',
    timeout: 10000,
    baseUrl: 'https://weixin.sogou.com',
    extractor: 'dom'
  },

  // ── Academic ──
  arxiv: {
    name: 'ArXiv',
    searchUrl: 'http://export.arxiv.org/api/query?search_query=all:{query}&max_results=10',
    type: 'academic',
    timeout: 15000,
    extractor: 'xml'
  },

  // ── Knowledge ──
  wikipedia_zh: {
    name: '维基百科(中文)',
    searchUrl: 'https://zh.wikipedia.org/w/index.php?search={query}&title=Special:Search',
    type: 'knowledge',
    timeout: 10000,
    extractor: 'dom'
  },
  wikipedia_en: {
    name: 'Wikipedia(EN)',
    searchUrl: 'https://en.wikipedia.org/w/index.php?search={query}&title=Special:Search',
    type: 'knowledge',
    timeout: 10000,
    extractor: 'dom'
  }
}

// ── Intent routing ──

const INTENT_CONFIG: Record<string, IntentConfig> = {
  general: {
    engines: ['baidu', 'bing_cn', 'bing_intl', 'sogou', 'so_360', 'toutiao'],
    maxConcurrent: 6
  },
  tech: {
    engines: ['github', 'bing_intl', 'bing_cn', 'sogou', 'toutiao'],
    maxConcurrent: 5
  },
  academic: {
    engines: ['arxiv', 'bing_intl', 'wikipedia_en'],
    maxConcurrent: 3
  },
  finance: {
    engines: ['baidu', 'bing_cn', 'sogou', 'bing_intl', 'toutiao'],
    maxConcurrent: 5
  },
  social: {
    engines: ['sogou_wechat', 'sogou', 'baidu', 'bing_cn'],
    maxConcurrent: 4
  },
  knowledge: {
    engines: ['wikipedia_zh', 'wikipedia_en', 'bing_intl'],
    maxConcurrent: 3
  }
}

// ── Intent detection ──

function detectIntent(query: string): string {
  const lower = query.toLowerCase()

  if (['site:', 'filetype:', 'intitle:', 'inurl:'].some((x) => query.includes(x))) {
    return 'general'
  }

  const academicKeywords = ['论文', 'paper', 'arxiv', '学术', '期刊', 'research', 'study', 'journal']
  if (academicKeywords.some((k) => lower.includes(k))) return 'academic'

  const techKeywords = ['python', 'javascript', '代码', 'github', 'stackoverflow', '编程', '开发', 'code', 'bug', 'error']
  if (techKeywords.some((k) => lower.includes(k))) return 'tech'

  const financeKeywords = ['股票', '基金', '财报', 'a股', '投资', '理财', '股市', 'stock', 'finance']
  if (financeKeywords.some((k) => lower.includes(k))) return 'finance'

  const socialKeywords = ['公众号', '微信', '知乎', '微博', '小红书', 'wechat']
  if (socialKeywords.some((k) => lower.includes(k))) return 'social'

  return 'general'
}

// ── Toutiao SSR extraction ──
// Toutiao embeds search results in <script> tags as:
//   window.T && T.flow({ data: {JSON}, src_id: "..." })
// We parse each JSON object and extract title/url/abstract.

function extractFromToutiaoSsr(html: string, engineName: string): SearchResultItem[] {
  const results: SearchResultItem[] = []
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null

  while ((match = scriptRegex.exec(html)) !== null) {
    const scriptContent = match[1]
    if (!scriptContent.includes('T.flow') || !scriptContent.includes('window.T')) continue

    // Find "data:" and extract the JSON value that follows
    const dataIdx = scriptContent.indexOf('data:')
    if (dataIdx < 0) continue
    const raw = scriptContent.slice(dataIdx + 5).trim()
    if (!raw.startsWith('{')) continue

    // Parse JSON with a manual scanner to handle nested objects
    let jsonStr: string | null = null
    let depth = 0
    let inString = false
    let escape = false
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i]
      if (escape) { escape = false; continue }
      if (ch === '\\') { escape = true; continue }
      if (ch === '"') { inString = !inString; continue }
      if (inString) continue
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          jsonStr = raw.slice(0, i + 1)
          break
        }
      }
    }

    if (!jsonStr) continue

    let data: Record<string, unknown>
    try {
      data = JSON.parse(jsonStr)
    } catch {
      continue
    }

    // Extract title, url, abstract from various data shapes
    let title = ''
    let url = ''
    let abstract = ''

    const disp = data.display
    if (disp && typeof disp === 'object' && !Array.isArray(disp)) {
      const d = disp as Record<string, unknown>
      const t = d.title
      if (t && typeof t === 'object') {
        title = (t as Record<string, unknown>).text as string ?? ''
      } else if (typeof t === 'string') {
        title = t
      }
      abstract = (d.abstract as string ?? d.summary_text as string ?? '') as string
    } else if (Array.isArray(disp) && disp.length > 0) {
      const first = disp[0] as Record<string, unknown>
      title = (first.title as string) ?? ''
      abstract = (first.abstract as string) ?? ''
      url = (first.item_source_url as string) ?? (first.url as string) ?? ''
    }

    if (!title) title = (data.title as string) ?? ''
    if (!abstract) abstract = (data.abstract as string) ?? ''
    if (!url) {
      url = (data.url as string) ?? (data.share_url as string) ?? (data.article_url as string) ?? ''
    }

    // Clean HTML tags from title
    title = title.replace(/<[^>]+>/g, '').trim()

    if (title.length > 5 && url) {
      // Resolve relative URLs
      if (url.startsWith('/')) {
        url = 'https://so.toutiao.com' + url
      }
      results.push({
        title: title.slice(0, 200),
        url: url.slice(0, 500),
        snippet: abstract.slice(0, 300),
        source_engine: engineName
      })
    }
  }

  return results.slice(0, 10)
}

// ── HTML extraction per engine ──

function extractFromHtml(html: string, engineId: string): SearchResultItem[] {
  const engine = ENGINES[engineId]
  const engineName = engine?.name ?? engineId

  // Toutiao uses SSR data extraction, not DOM parsing
  if (engine?.extractor === 'toutiao_ssr') {
    return extractFromToutiaoSsr(html, engineName)
  }

  // Inject <base> tag so relative URLs (e.g. /link?url=...) resolve correctly
  const baseUrl = engine?.baseUrl
  const htmlWithBase = baseUrl
    ? html.replace(/<head([^>]*)>/i, `<head$1><base href="${baseUrl}">`)
    : html

  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlWithBase, 'text/html')
  const results: SearchResultItem[] = []

  const addResult = (title: string, url: string, snippet: string): void => {
    if (title && url && title.length >= 5) {
      results.push({
        title: title.slice(0, 200),
        url: url.slice(0, 500),
        snippet: snippet.slice(0, 300),
        source_engine: engineName
      })
    }
  }

  switch (engineId) {
    case 'baidu':
      doc.querySelectorAll('.result.c-container, .c-container, .result').forEach((item) => {
        const titleEl = item.querySelector('h3 a, .t a')
        if (!titleEl) return
        const anchor = titleEl as HTMLAnchorElement
        const snippetEl = item.querySelector('.c-abstract, [class*="content-right"], [class*="abstract"]')
        addResult(anchor.textContent?.trim() ?? '', anchor.href, snippetEl?.textContent?.trim() ?? '')
      })
      break

    case 'bing_cn':
    case 'bing_intl':
      doc.querySelectorAll('#b_results > li.b_algo, #b_results .b_algo').forEach((item) => {
        const titleEl = item.querySelector('h2 a[href]')
        if (!titleEl) return
        const anchor = titleEl as HTMLAnchorElement
        const snippetEl = item.querySelector('.b_caption p, .b_lineclamp2, .b_lineclamp3, .b_lineclamp4, p')
        addResult(anchor.textContent?.trim() ?? '', anchor.href, snippetEl?.textContent?.trim() ?? '')
      })
      // Fallback: any h2 > a
      if (results.length === 0) {
        doc.querySelectorAll('#b_results h2 a[href]').forEach((a) => {
          const anchor = a as HTMLAnchorElement
          addResult(anchor.textContent?.trim() ?? '', anchor.href, '')
        })
      }
      break

    case 'sogou':
      // Sogou uses .vrwrap containers with h3.vr-title > a for title
      doc.querySelectorAll('.vrwrap, .result, .rb').forEach((item) => {
        const titleEl = item.querySelector('h3.vr-title a, h3 a, .vr-title a')
        if (!titleEl) return
        const anchor = titleEl as HTMLAnchorElement
        const snippetEl = item.querySelector('.space-txt, .str-text-info, .fz-mid, p')
        addResult(anchor.textContent?.trim() ?? '', anchor.href, snippetEl?.textContent?.trim() ?? '')
      })
      break

    case 'so_360':
      doc.querySelectorAll('.result, .g-card').forEach((item) => {
        const titleEl = item.querySelector('a[href]')
        if (!titleEl) return
        const anchor = titleEl as HTMLAnchorElement
        const snippetEl = item.querySelector('p, .res-desc')
        addResult(anchor.textContent?.trim() ?? '', anchor.href, snippetEl?.textContent?.trim() ?? '')
      })
      break

    case 'sogou_wechat':
      // Sogou WeChat: .news-list li > .txt-box > h3 a for title
      doc.querySelectorAll('.news-list li, .txt-box, .weui_media_box').forEach((item) => {
        const titleEl = item.querySelector('h3 a, h4 a, a[href]')
        if (!titleEl) return
        const anchor = titleEl as HTMLAnchorElement
        const snippetEl = item.querySelector('.txt-info, p, .s-p')
        addResult(anchor.textContent?.trim() ?? '', anchor.href, snippetEl?.textContent?.trim() ?? '')
      })
      break

    case 'github':
      doc.querySelectorAll('.repo-list-item, [data-testid="results-list"] > div').forEach((item) => {
        const linkEl = item.querySelector('a[href]')
        if (!linkEl) return
        const anchor = linkEl as HTMLAnchorElement
        const snippetEl = item.querySelector('p, .repo-list-description')
        addResult(anchor.textContent?.trim() ?? '', anchor.href, snippetEl?.textContent?.trim() ?? '')
      })
      break

    case 'arxiv':
      // ArXiv returns Atom XML, parse with DOMParser
      doc.querySelectorAll('entry').forEach((entry) => {
        const titleEl = entry.querySelector('title')
        const idEl = entry.querySelector('id')
        const summaryEl = entry.querySelector('summary')
        addResult(
          titleEl?.textContent?.trim() ?? '',
          idEl?.textContent?.trim() ?? '',
          summaryEl?.textContent?.trim() ?? ''
        )
      })
      break

    case 'wikipedia_zh':
    case 'wikipedia_en':
      doc.querySelectorAll('.mw-search-result').forEach((item) => {
        const linkEl = item.querySelector('a[href]')
        if (!linkEl) return
        const anchor = linkEl as HTMLAnchorElement
        const snippetEl = item.querySelector('.mw-search-result-data, .searchresult')
        addResult(anchor.textContent?.trim() ?? '', anchor.href, snippetEl?.textContent?.trim() ?? '')
      })
      // If no search results, try the article page itself
      if (results.length === 0) {
        const title = doc.querySelector('#firstHeading')?.textContent?.trim() ?? ''
        const body = doc.querySelector('#mw-content-text p')?.textContent?.trim() ?? ''
        if (title) {
          addResult(title, doc.location?.href ?? '', body.slice(0, 300))
        }
      }
      break
  }

  // Generic fallback for any engine
  if (results.length === 0) {
    doc.querySelectorAll('h2 a[href], h3 a[href]').forEach((a) => {
      const anchor = a as HTMLAnchorElement
      const href = anchor.href
      // Skip internal links
      if (href.includes('bing.com') && href.includes('search')) return
      if (href.includes('google.com')) return
      addResult(anchor.textContent?.trim() ?? '', href, '')
    })
  }

  return results.slice(0, 10) // Max 10 per engine
}

// ── Deduplication ──

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname.replace(/\/$/, '')}`.toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

function titleSimilarity(a: string, b: string): number {
  const na = a.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').toLowerCase()
  const nb = b.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').toLowerCase()
  if (!na || !nb) return 0
  // Simple Jaccard on character bigrams
  const bigramsA = new Set<string>()
  for (let i = 0; i < na.length - 1; i++) bigramsA.add(na.slice(i, i + 2))
  const bigramsB = new Set<string>()
  for (let i = 0; i < nb.length - 1; i++) bigramsB.add(nb.slice(i, i + 2))
  let intersection = 0
  for (const bg of bigramsA) if (bigramsB.has(bg)) intersection++
  const union = bigramsA.size + bigramsB.size - intersection
  return union > 0 ? intersection / union : 0
}

function deduplicate(results: SearchResultItem[], maxResults: number): SearchResultItem[] {
  const TITLE_THRESHOLD = 0.82
  const seenUrls = new Set<string>()
  const kept: SearchResultItem[] = []

  for (const r of results) {
    const urlKey = normalizeUrl(r.url)
    if (seenUrls.has(urlKey)) continue

    // Title similarity check
    let isDup = false
    for (const k of kept) {
      if (titleSimilarity(r.title, k.title) >= TITLE_THRESHOLD) {
        isDup = true
        break
      }
    }

    if (!isDup) {
      seenUrls.add(urlKey)
      kept.push(r)
      if (kept.length >= maxResults) break
    }
  }

  return kept
}

// ── Core search execution ──

export async function executeBrowserSearch(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResultContent> {
  const query = (input.query as string)?.trim()
  if (!query) {
    return encodeToolError('query is required')
  }

  const maxResults = Math.min((input.maxResults as number) ?? 10, 30)
  const intentOverride = (input.intent as string)?.trim()
  const intent = intentOverride && INTENT_CONFIG[intentOverride]
    ? intentOverride
    : detectIntent(query)

  const intentConfig = INTENT_CONFIG[intent] ?? INTENT_CONFIG.general
  const engineIds = intentConfig.engines.filter((id) => ENGINES[id])
  const maxConcurrent = intentConfig.maxConcurrent

  // Fetch all engines in parallel (with concurrency limit)
  const allResults: SearchResultItem[] = []
  const engineStatus: Array<{ engine: string; status: 'ok' | 'empty' | 'error'; count: number; error?: string }> = []

  // Simple concurrency limiter
  const queue = [...engineIds]
  const running: Promise<void>[] = []

  async function runEngine(engineId: string): Promise<void> {
    const engine = ENGINES[engineId]
    const url = engine.searchUrl.replace('{query}', encodeURIComponent(query))

    try {
      let html: string

      if (engine.renderMode === 'rendered') {
        // Use hidden BrowserWindow for JS-rendered pages
        const rendered = await ctx.ipc.invoke('web:fetch-rendered', {
          url,
          waitMs: engine.renderWaitMs ?? 3000
        }) as { content?: string; error?: string }

        if (rendered.error) {
          engineStatus.push({ engine: engine.name, status: 'error', count: 0, error: rendered.error })
          return
        }
        html = rendered.content ?? ''
      } else {
        // Plain HTTP fetch via Worker
        const fetchResult = await ctx.ipc.invoke('web:fetch', {
          url,
          format: 'html',
          timeout: engine.timeout
        }) as {
          results?: Array<{ content?: string; error?: string }>
          error?: string
        }

        if (fetchResult.error) {
          engineStatus.push({ engine: engine.name, status: 'error', count: 0, error: fetchResult.error })
          return
        }

        // web/fetch returns { results: [{ content, ... }] } - extract the first result
        const firstResult = fetchResult.results?.[0]
        if (firstResult?.error) {
          engineStatus.push({ engine: engine.name, status: 'error', count: 0, error: firstResult.error })
          return
        }
        html = firstResult?.content ?? ''
      }
      if (!html) {
        engineStatus.push({ engine: engine.name, status: 'empty', count: 0 })
        return
      }

      const results = extractFromHtml(html, engineId)
      if (results.length > 0) {
        allResults.push(...results)
        engineStatus.push({ engine: engine.name, status: 'ok', count: results.length })
      } else {
        engineStatus.push({ engine: engine.name, status: 'empty', count: 0 })
      }
    } catch (err) {
      engineStatus.push({
        engine: engine.name,
        status: 'error',
        count: 0,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  async function pump(): Promise<void> {
    while (queue.length > 0) {
      const engineId = queue.shift()!
      await runEngine(engineId)
    }
  }

  // Launch concurrent workers
  const workerCount = Math.min(maxConcurrent, engineIds.length)
  for (let i = 0; i < workerCount; i++) {
    running.push(pump())
  }
  await Promise.all(running)

  // Deduplicate and cap
  const aggregated = deduplicate(allResults, maxResults)

  const okEngines = engineStatus.filter((s) => s.status === 'ok')
  const failedEngines = engineStatus.filter((s) => s.status !== 'ok')

  return encodeStructuredToolResult({
    query,
    intent,
    results: aggregated,
    count: aggregated.length,
    engines_queried: engineIds.length,
    engines_succeeded: okEngines.length,
    engines_failed: failedEngines.length,
    engine_details: engineStatus,
    total_fetched: allResults.length,
    after_deduplication: aggregated.length
  })
}

// ── Tool definition & registration ──

const browserSearchHandler: ToolHandler = {
  definition: {
    name: 'BrowserSearch',
    description: [
      'Multi-engine aggregated web search. No API key required.',
      '',
      'Automatically detects query intent and selects the best engine',
      'combination. Queries multiple search engines in parallel, then',
      'deduplicates and ranks results.',
      '',
      'Supported engines (11):',
      '  General: Baidu, Bing CN/Intl, Sogou, 360, Toutiao',
      '  Tech:    GitHub (browser-rendered)',
      '  Social:  Sogou WeChat (public account articles)',
      '  Academic: ArXiv',
      '  Knowledge: Wikipedia (zh/en)',
      '',
      'Intent routing:',
      '- general: Baidu + Bing CN/Intl + Sogou + 360 + Toutiao (6 engines)',
      '- tech: GitHub + Bing CN/Intl + Sogou + Toutiao (5 engines)',
      '- academic: ArXiv + Bing Intl + Wikipedia',
      '- finance: Baidu + Bing CN/Intl + Sogou + Toutiao (5 engines)',
      '- social: Sogou WeChat + Sogou + Baidu + Bing CN',
      '- knowledge: Wikipedia (zh/en) + Bing Intl',
      '',
      'Results include title, URL, snippet, and source engine.',
      'Summarize the aggregated results for the user directly.',
    ].join('\n'),
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query'
        },
        intent: {
          type: 'string',
          description: 'Override auto-detected intent',
          enum: ['general', 'tech', 'academic', 'finance', 'social', 'knowledge']
        },
        maxResults: {
          type: 'number',
          description: 'Maximum results after deduplication. Default 10.',
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
