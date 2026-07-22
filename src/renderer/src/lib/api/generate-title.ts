import { useSettingsStore } from '@renderer/stores/settings-store'
import { useProviderStore } from '@renderer/stores/provider-store'
import { runSidecarTextRequest } from '@renderer/lib/ipc/agent-bridge'
import { RESPONSES_SESSION_SCOPE_GENERATE_TITLE } from './responses-session-policy'
import type { ProviderConfig, UnifiedMessage } from './types'
import { SESSION_ICONS_PROMPT_LIST } from '@renderer/lib/constants/session-icons'
import { type AppLanguage } from '@renderer/lib/i18n-language'
import {
  type WorkspacePromptCacheScope,
  withWorkspacePromptCacheKey
} from '@renderer/lib/agent/prompt-cache-key'

export interface SessionTitleResult {
  title: string
  icon: string
}

export type FriendlyStatus = 'idle' | 'pending' | 'error' | 'streaming' | 'agents' | 'background'

const FRIENDLY_MESSAGES: Record<
  FriendlyStatus,
  { zh: string[]; en: string[]; ja: string[]; ko: string[] }
> = {
  idle: {
    zh: [
      '随时准备为你效劳',
      '有什么想法，尽管说',
      '今天也是元气满满的一天',
      '准备就绪，等你发令',
      '万事俱备，只欠你开口',
      '灵感来了就别犹豫',
      '你的专属助手已上线',
      '静候佳音'
    ],
    en: [
      'Ready when you are',
      'What shall we build today?',
      'Standing by for your ideas',
      'All systems go',
      'Your assistant is ready',
      'Inspiration awaits',
      "Let's get things done",
      'At your service'
    ],
    ja: [
      'いつでもお手伝いできます',
      '今日は何を作りましょうか？',
      'アイデアをお待ちしています',
      '準備はできています',
      'あなたのひらめきを待っています',
      'ひらめきを形にしましょう',
      'いつでもどうぞ',
      'お任せください'
    ],
    ko: [
      '언제든 도와드릴 준비가 되어 있어요',
      '오늘은 무엇을 만들까요?',
      '아이디어를 기다리고 있어요',
      '준비 완료',
      '언제든 말씀만 주세요',
      '함께 시작해볼까요',
      '대기 중입니다',
      '맡겨 주세요'
    ]
  },
  streaming: {
    zh: ['思考中，请稍候', '正在组织回答', '全力运转中', '马上就好', '正在为你解答', '灵感涌来中'],
    en: [
      'Thinking...',
      'Working on it',
      'Almost there',
      'Processing your request',
      'Crafting a response',
      'On it'
    ],
    ja: [
      '考え中です…',
      '回答をまとめています',
      'もうすぐです',
      '応答を生成中',
      '整理しています',
      '処理中です'
    ],
    ko: [
      '생각 중…',
      '답변을 정리하는 중',
      '거의 다 됐어요',
      '응답을 생성 중',
      '정리하고 있어요',
      '처리 중입니다'
    ]
  },
  pending: {
    zh: ['等待你的确认', '需要你看一下', '请审批操作', '操作待确认'],
    en: [
      'Waiting for your approval',
      'Action needs confirmation',
      'Please review',
      'Approval needed'
    ],
    ja: ['承認を待っています', '確認をお願いします', '操作の承認が必要です', '保留中です'],
    ko: ['승인을 기다리는 중', '확인이 필요해요', '작업 승인 필요', '대기 중입니다']
  },
  error: {
    zh: ['遇到了一点问题', '出了点小状况', '别担心，我们来看看', '需要你关注一下'],
    en: ['Something went wrong', 'Hit a snag', "Let's take a look", 'Needs your attention'],
    ja: ['問題が発生しました', '少しつまずきました', '一緒に確認しましょう', '対応が必要です'],
    ko: ['문제가 발생했어요', '조금 막혔습니다', '같이 살펴봐요', '확인이 필요합니다']
  },
  agents: {
    zh: ['子任务进行中', '团队协作中', '多个助手协同工作中', '正在并行处理'],
    en: ['Sub-agents at work', 'Team is collaborating', 'Working in parallel', 'Agents are on it'],
    ja: [
      'サブタスクが進行中',
      'チームで協力しています',
      '複数のエージェントが並行作業中',
      '分担して処理しています'
    ],
    ko: ['하위 작업이 진행 중', '팀이 협업 중', '여러 에이전트가 병렬 처리 중', '분담해서 작업 중']
  },
  background: {
    zh: ['后台任务运行中', '命令执行中', '后台进程工作中'],
    en: ['Background tasks running', 'Commands in progress', 'Working in the background'],
    ja: ['バックグラウンドで実行中', 'コマンドを実行中', 'バックグラウンド処理が進行中'],
    ko: ['백그라운드 작업 실행 중', '명령 실행 중', '백그라운드에서 처리 중']
  }
}

const lastPickIndex: Record<string, number> = {}

export function pickFriendlyMessage(status: FriendlyStatus, language: AppLanguage): string {
  const pool =
    FRIENDLY_MESSAGES[status]?.[language] ??
    FRIENDLY_MESSAGES[status]?.en ??
    FRIENDLY_MESSAGES.idle[language] ??
    FRIENDLY_MESSAGES.idle.en
  const key = `${status}_${language}`
  const prevIdx = lastPickIndex[key] ?? -1
  let idx = Math.floor(Math.random() * pool.length)
  if (pool.length > 1 && idx === prevIdx) idx = (idx + 1) % pool.length
  lastPickIndex[key] = idx
  return pool[idx]
}

const stripReasoningBlocks = (value: string): string =>
  value.replace(/<think\b[^>]*>[\s\S]*?(?:<\/think>|$)/gi, '').replace(/<\/think>/gi, '')

const stripMarkdown = (value: string): string =>
  value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')

const looksLikeReasoning = (value: string): boolean => {
  const markers = [
    /思考过程/,
    /分析.*指令/,
    /\*\*目标\*\*/,
    /步骤\s*\d/,
    /^(?:\d+\.\s)/m,
    /^\s*[-*]\s+\*\*/m
  ]
  return markers.filter((r) => r.test(value)).length >= 2
}

const TITLE_SYSTEM_PROMPT = `You are a title generator. Given a user message or conversation excerpt, produce:
1. A concise title (max 30 characters) that summarizes the intent.
2. Pick ONE icon name from the following Lucide icon list that best represents the topic:
${SESSION_ICONS_PROMPT_LIST}

Reply with ONLY a JSON object in this exact format (no markdown, no explanation):
{"title":"your title here","icon":"icon-name"}`

/**
 * Use the fast model to generate a short session title from a user message or conversation excerpt.
 * Runs in the background — does not block the main chat flow.
 * Returns { title, icon } or null on failure.
 */
export async function generateSessionTitle(
  userMessage: string,
  options?: {
    maxInputChars?: number
    workspace?: WorkspacePromptCacheScope
  }
): Promise<SessionTitleResult | null> {
  const settings = useSettingsStore.getState()

  const fastConfig = useProviderStore.getState().getFastProviderConfig()
  const config: ProviderConfig | null = fastConfig
    ? {
        ...fastConfig,
        maxTokens: 100,
        temperature: 0.3,
        systemPrompt: TITLE_SYSTEM_PROMPT,
        responseSummary: useProviderStore.getState().getActiveModelConfig()?.responseSummary,
        enablePromptCache: useProviderStore.getState().getActiveModelConfig()?.enablePromptCache,
        enableSystemPromptCache: useProviderStore.getState().getActiveModelConfig()
          ?.enableSystemPromptCache
      }
    : settings.apiKey && settings.model
      ? {
          type: settings.provider,
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl || undefined,
          model: settings.model,
          maxTokens: 100,
          temperature: 0.3,
          systemPrompt: TITLE_SYSTEM_PROMPT,
          responseSummary: useProviderStore.getState().getActiveModelConfig()?.responseSummary,
          enablePromptCache: useProviderStore.getState().getActiveModelConfig()?.enablePromptCache,
          enableSystemPromptCache: useProviderStore.getState().getActiveModelConfig()
            ?.enableSystemPromptCache
        }
      : null

  if (!config || (config.requiresApiKey !== false && !config.apiKey)) return null
  const scopedConfig = await withWorkspacePromptCacheKey(config, options?.workspace)

  const messages: UnifiedMessage[] = [
    {
      id: 'title-req',
      role: 'user',
      content: userMessage.slice(0, options?.maxInputChars ?? 500),
      createdAt: Date.now()
    }
  ]

  try {
    const abortController = new AbortController()
    const timeout = setTimeout(() => abortController.abort(), 15000)

    const title = await runSidecarTextRequest({
      provider: scopedConfig,
      messages,
      signal: abortController.signal,
      maxIterations: 1,
      responsesSessionScope: RESPONSES_SESSION_SCOPE_GENERATE_TITLE
    })
    clearTimeout(timeout)

    if (looksLikeReasoning(title)) return null

    const cleaned = stripReasoningBlocks(title)
      .replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1')
      .trim()
    if (!cleaned) return null

    try {
      const jsonMatch =
        cleaned.match(/\{[^{}]*"title"\s*:\s*"[^"]*"[^{}]*\}/) ?? cleaned.match(/\{[\s\S]*?\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.title && parsed.icon) {
          let t = stripMarkdown(stripReasoningBlocks(String(parsed.title)))
            .replace(/^["']|["']$/g, '')
            .replace(/\n+/g, ' ')
            .trim()
          if (t.length > 40) t = t.slice(0, 40) + '...'
          return { title: t, icon: String(parsed.icon).trim() }
        }
      }
    } catch {
      /* fall through to plain-text fallback */
    }

    let plainTitle = stripMarkdown(stripReasoningBlocks(cleaned))
      .replace(/^["']|["']$/g, '')
      .replace(/[{}]/g, '')
      .replace(/\n+/g, ' ')
      .trim()
    if (plainTitle.length > 40) plainTitle = plainTitle.slice(0, 40) + '...'
    return { title: plainTitle, icon: 'message-square' }
  } catch {
    return null
  }
}
