import { create } from 'zustand'

// ─── Simplified quota store ───
// From OpenCowork, reduced to just what ModelSwitcher needs.
// IPC listener registration removed (no backend quota system yet).

export interface CodexQuotaWindow {
  usedPercent?: number
  windowMinutes?: number
  resetAt?: string
  resetAfterSeconds?: number
}

export interface CodexQuota {
  type: 'codex'
  planType?: string
  primary?: CodexQuotaWindow
  secondary?: CodexQuotaWindow
  primaryOverSecondaryLimitPercent?: number
  credits?: {
    hasCredits?: boolean
    balance?: number
    unlimited?: boolean
  }
  fetchedAt: number
}

export interface CopilotQuota {
  type: 'copilot'
  sku?: string
  chatEnabled?: boolean
  telemetry?: string
  apiBaseUrl?: string
  tokenExpiresAt?: number
  fetchedAt: number
}


export interface KimiQuota { [key: string]: unknown }
export interface KimiQuotaWindow { [key: string]: unknown }

export type ProviderQuota = CodexQuota | CopilotQuota | KimiQuota

interface QuotaStore {
  quotaByKey: Record<string, ProviderQuota>
  updateQuota: (key: string, quota: ProviderQuota) => void
  clearQuota: (key: string) => void
}

export const useQuotaStore = create<QuotaStore>((set) => ({
  quotaByKey: {},
  updateQuota: (key, quota) =>
    set((state) => ({ quotaByKey: { ...state.quotaByKey, [key]: quota } })),
  clearQuota: (key) =>
    set((state) => {
      const next = { ...state.quotaByKey }
      delete next[key]
      return { quotaByKey: next }
    })
}))

