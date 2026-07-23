/**
 * Browser access decision stub.
 * Placeholder for the full browser-access module that will be migrated later.
 */

export interface BrowserAccessDecision {
  allowed: boolean
  reason?: string
}

/**
 * Returns a stub access decision that always allows the given URL.
 * Replace with real logic when the browser-access module is migrated.
 */
export function getBrowserAccessDecision(url: string): BrowserAccessDecision {
  return { allowed: true }
}
