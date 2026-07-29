/**
 * Lightweight tool definition cache — no store/component imports.
 *
 * getCachedTools() returns synchronously (cached value or null).
 * fetchToolDefinitions() fires a background Worker request to warm the cache.
 *
 * This module is safe to import from App.tsx or any other entry point
 * without triggering circular dependency chains through stores.
 */

interface CachedToolDef {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

let cachedTools: CachedToolDef[] | null = null
let cachedPreset: string | null = null
let fetchInFlight: Promise<void> | null = null

export function getCachedTools(): CachedToolDef[] | null {
  return cachedTools
}

export function fetchToolDefinitions(preset = 'chat'): void {
  if (cachedTools && cachedPreset === preset) return
  if (fetchInFlight) return
  fetchInFlight = (async () => {
    try {
      const result = await window.api.workerRequest<{ tools: CachedToolDef[] }>('tool/list', { preset })
      cachedTools = result.tools
      cachedPreset = preset
    } catch {
      // Worker not ready yet; will retry on next call
    } finally {
      fetchInFlight = null
    }
  })()
}
