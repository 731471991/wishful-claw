import type { ProviderConfig } from '../api/types'
import { ipcClient } from '../ipc/ipc-client'

const PROMPT_CACHE_INSTALL_ID_CONFIG_KEY = 'opencowork-prompt-cache-install-id'
const OPENAI_PROMPT_CACHE_KEY_MAX_LENGTH = 64

let cachedInstallId: string | null = null
let installIdPromise: Promise<string> | null = null

export interface WorkspacePromptCacheScope {
  projectId?: string | null
  workingFolder?: string | null
  sshConnectionId?: string | null
  target?: string | null
}

function isUsableInstallId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 16
}

function createInstallId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `install-${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
}

function normalizeScopePart(value?: string | null): string {
  return (value ?? '').trim().replace(/\\/g, '/').replace(/\/+$/g, '').toLowerCase()
}

function hasWorkspaceIdentity(scope: WorkspacePromptCacheScope): boolean {
  return Boolean(
    normalizeScopePart(scope.projectId) ||
    normalizeScopePart(scope.workingFolder) ||
    normalizeScopePart(scope.sshConnectionId)
  )
}

function buildWorkspaceIdentity(scope: WorkspacePromptCacheScope): string {
  const target = normalizeScopePart(scope.target) || (scope.sshConnectionId ? 'ssh' : 'local')
  return [
    `target=${target}`,
    `project=${normalizeScopePart(scope.projectId)}`,
    `folder=${normalizeScopePart(scope.workingFolder)}`,
    `ssh=${normalizeScopePart(scope.sshConnectionId)}`
  ].join('\n')
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  return toHex(await globalThis.crypto.subtle.digest('SHA-256', data))
}

export function clampOpenAIPromptCacheKey(value?: string | null): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  const chars = Array.from(trimmed)
  return chars.length <= OPENAI_PROMPT_CACHE_KEY_MAX_LENGTH
    ? trimmed
    : chars.slice(0, OPENAI_PROMPT_CACHE_KEY_MAX_LENGTH).join('')
}

async function ensurePromptCacheInstallId(): Promise<string> {
  if (cachedInstallId) return cachedInstallId
  if (installIdPromise) return installIdPromise

  installIdPromise = (async () => {
    const existing = await ipcClient.invoke('config:get', PROMPT_CACHE_INSTALL_ID_CONFIG_KEY)
    if (isUsableInstallId(existing)) {
      cachedInstallId = existing.trim()
      return cachedInstallId
    }

    const generated = createInstallId()
    cachedInstallId = generated
    await ipcClient.invoke('config:set', {
      key: PROMPT_CACHE_INSTALL_ID_CONFIG_KEY,
      value: generated
    })
    return generated
  })().finally(() => {
    installIdPromise = null
  })

  return installIdPromise
}

export async function buildWorkspacePromptCacheKey(
  scope: WorkspacePromptCacheScope = {}
): Promise<string> {
  const installId = await ensurePromptCacheInstallId()
  const installHash = (await sha256Hex(`install:${installId}`)).slice(0, 16)

  if (!hasWorkspaceIdentity(scope)) {
    return `ocw-global-${installHash}`
  }

  const workspaceHash = (
    await sha256Hex(`workspace:${installId}\n${buildWorkspaceIdentity(scope)}`)
  ).slice(0, 24)
  return `ocw-ws-${installHash}-${workspaceHash}`
}

function hasPromptCacheKeyOverride(config: ProviderConfig): boolean {
  const override = config.requestOverrides?.body?.prompt_cache_key
  return typeof override === 'string' && override.trim().length > 0
}

export async function withWorkspacePromptCacheKey(
  config: ProviderConfig,
  scope: WorkspacePromptCacheScope = {}
): Promise<ProviderConfig> {
  const shouldApplyWorkspaceKey =
    config.type === 'openai-responses' ||
    (config.type === 'openai-chat' && config.enablePromptCache === true)

  if (!shouldApplyWorkspaceKey || hasPromptCacheKeyOverride(config)) {
    return config
  }

  const explicit = clampOpenAIPromptCacheKey(config.promptCacheKey)
  return {
    ...config,
    promptCacheKey: explicit ?? (await buildWorkspacePromptCacheKey(scope))
  }
}
