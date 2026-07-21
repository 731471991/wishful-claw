/**
 * Permission whitelist policy shared between renderer, main and (mirrored in) the
 * .NET native worker — `AgentRuntimePermissionPolicy.cs` must keep the same semantics.
 *
 * Precedence: bash deny rules > tool whitelist / bash allow rules > normal approval flow.
 * Command-rule matching is case-insensitive; tool-name matching is case-sensitive.
 * Allow rules must describe the ENTIRE command (wildcard and regex are both anchored,
 * and every segment of a compound command must match); deny regex rules are unanchored.
 */

export type PermissionRuleMode = 'wildcard' | 'regex'

export interface PermissionRule {
  id: string
  pattern: string
  mode: PermissionRuleMode
  enabled: boolean
}

export interface PermissionPolicy {
  enabled: boolean
  /** Tool names that skip the confirmation dialog. Entries may use `*` / `?` wildcards. */
  whitelistedTools: string[]
  /** Commands matching one of these skip the confirmation dialog. */
  bashAllowRules: PermissionRule[]
  /** Commands matching one of these are rejected outright — highest priority. */
  bashDenyRules: PermissionRule[]
}

export type PermissionEvaluation =
  | { decision: 'deny'; rule: PermissionRule }
  | { decision: 'allow'; source: 'tool-whitelist' | 'bash-allow' }
  | { decision: 'ask' }

export const DEFAULT_PERMISSION_POLICY: PermissionPolicy = {
  enabled: false,
  whitelistedTools: [],
  bashAllowRules: [],
  bashDenyRules: []
}

/** Tools whose `command` input is subject to the bash allow/deny rules. */
export const COMMAND_RULE_TOOL_NAMES = ['Bash', 'Shell', 'Monitor', 'PowerShell'] as const

const MAX_PATTERN_LENGTH = 1000

export function isCommandRuleTool(toolName: string): boolean {
  return COMMAND_RULE_TOOL_NAMES.includes(toolName as (typeof COMMAND_RULE_TOOL_NAMES)[number])
}

export function extractCommandInput(input: Record<string, unknown> | undefined): string | null {
  const command = input?.command
  return typeof command === 'string' ? command : null
}

export function createPermissionRuleId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID()
  return `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function escapeRegexChar(char: string): string {
  return /[.*+?^${}()|[\]\\]/.test(char) ? `\\${char}` : char
}

/** Compile a wildcard pattern (`*` = any text, `?` = any char) to an anchored regex source. */
export function wildcardToRegexSource(pattern: string): string {
  let source = ''
  for (const char of pattern) {
    if (char === '*') source += '[\\s\\S]*'
    else if (char === '?') source += '[\\s\\S]'
    else source += escapeRegexChar(char)
  }
  return `^${source}$`
}

function compileRuleRegex(rule: PermissionRule, kind: 'allow' | 'deny'): RegExp | null {
  if (!rule.pattern || rule.pattern.length > MAX_PATTERN_LENGTH) return null
  try {
    if (rule.mode === 'regex') {
      // Allow rules must describe the whole command; deny rules hit on any substring.
      const source = kind === 'allow' ? `^(?:${rule.pattern})$` : rule.pattern
      return new RegExp(source, 'i')
    }
    return new RegExp(wildcardToRegexSource(rule.pattern), 'i')
  } catch {
    return null
  }
}

/** Returns an error message for an invalid rule pattern, or null when the rule is usable. */
export function validatePermissionRulePattern(
  rule: Pick<PermissionRule, 'pattern' | 'mode'>
): string | null {
  if (!rule.pattern.trim()) return 'empty pattern'
  if (rule.pattern.length > MAX_PATTERN_LENGTH) return 'pattern too long'
  if (rule.mode === 'wildcard') return null
  try {
    new RegExp(rule.pattern)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

/**
 * Allow-matching is disqualified when the command contains command/process/variable
 * substitution, because a nested expansion can smuggle arbitrary execution past a
 * prefix-style rule. Deny rules still apply.
 */
export function hasShellExpansion(command: string): boolean {
  return /\$\(|`|\$\{|<\(|>\(/.test(command)
}

/**
 * Split a compound command on shell separators (`&&`, `||`, `;`, `|`, `&`, newline) so every
 * segment must independently match an allow rule. Redirections like `2>&1` / `&>` are kept
 * intact. Not quote-aware — quoted separators over-split, which fails safe (falls back to
 * the confirmation dialog).
 */
export function splitCommandSegments(command: string): string[] {
  const segments: string[] = []
  let current = ''
  let index = 0
  const push = (): void => {
    const trimmed = current.trim()
    if (trimmed) segments.push(trimmed)
    current = ''
  }
  while (index < command.length) {
    const char = command[index]
    const next = index + 1 < command.length ? command[index + 1] : ''
    const prev = index > 0 ? command[index - 1] : ''
    if (char === '\n' || char === ';') {
      push()
      index += 1
    } else if (char === '|') {
      push()
      index += next === '|' || next === '&' ? 2 : 1
    } else if (char === '&') {
      if (next === '&') {
        push()
        index += 2
      } else if (prev === '>' || next === '>') {
        current += char
        index += 1
      } else {
        push()
        index += 1
      }
    } else {
      current += char
      index += 1
    }
  }
  push()
  return segments
}

/** Find the first enabled deny rule matching the command (raw string or any segment). */
export function findDenyRuleMatch(
  command: string,
  policy: PermissionPolicy
): PermissionRule | null {
  const text = command.trim()
  if (!text) return null
  let segments: string[] | null = null
  for (const rule of policy.bashDenyRules) {
    if (!rule.enabled) continue
    const regex = compileRuleRegex(rule, 'deny')
    if (!regex) continue
    if (regex.test(text)) return rule
    if (rule.mode === 'wildcard') {
      segments ??= splitCommandSegments(text)
      if (segments.some((segment) => regex.test(segment))) return rule
    }
  }
  return null
}

/** Whether every segment of the command matches at least one enabled allow rule. */
export function commandMatchesAllowRules(command: string, policy: PermissionPolicy): boolean {
  const text = command.trim()
  if (!text || hasShellExpansion(text)) return false
  const compiled = policy.bashAllowRules
    .filter((rule) => rule.enabled)
    .map((rule) => compileRuleRegex(rule, 'allow'))
    .filter((regex): regex is RegExp => regex !== null)
  if (compiled.length === 0) return false
  const segments = splitCommandSegments(text)
  if (segments.length === 0) return false
  return segments.every((segment) => compiled.some((regex) => regex.test(segment)))
}

export function isToolWhitelisted(toolName: string, policy: PermissionPolicy): boolean {
  const name = toolName.trim()
  if (!name) return false
  return policy.whitelistedTools.some((entry) => {
    if (entry === name) return true
    if (!entry.includes('*') && !entry.includes('?')) return false
    if (entry.length > MAX_PATTERN_LENGTH) return false
    try {
      return new RegExp(wildcardToRegexSource(entry)).test(name)
    } catch {
      return false
    }
  })
}

/**
 * Evaluate the whitelist policy for one tool call.
 * `deny` → reject without executing; `allow` → skip the confirmation dialog;
 * `ask` → fall through to the normal approval flow.
 */
export function evaluateToolPermission(
  toolName: string,
  input: Record<string, unknown> | undefined,
  policy: PermissionPolicy | undefined
): PermissionEvaluation {
  if (!policy?.enabled) return { decision: 'ask' }
  const command = isCommandRuleTool(toolName) ? extractCommandInput(input) : null
  if (command !== null) {
    const denyRule = findDenyRuleMatch(command, policy)
    if (denyRule) return { decision: 'deny', rule: denyRule }
  }
  if (isToolWhitelisted(toolName, policy)) return { decision: 'allow', source: 'tool-whitelist' }
  if (command !== null && commandMatchesAllowRules(command, policy)) {
    return { decision: 'allow', source: 'bash-allow' }
  }
  return { decision: 'ask' }
}

/** Wire shape sent to the native worker in the agent run request (`permissionPolicy` key). */
export interface PermissionPolicySnapshot {
  enabled: boolean
  whitelistedTools: string[]
  bashAllowRules: { pattern: string; mode: PermissionRuleMode }[]
  bashDenyRules: { pattern: string; mode: PermissionRuleMode }[]
}

/**
 * Build the run-request payload from the stored policy. Returns undefined when the policy
 * is disabled or has no content, so the run request stays byte-identical to today.
 */
export function toPermissionPolicySnapshot(
  policy: PermissionPolicy | undefined
): PermissionPolicySnapshot | undefined {
  if (!policy?.enabled) return undefined
  const rules = (list: PermissionRule[]): { pattern: string; mode: PermissionRuleMode }[] =>
    list.filter((rule) => rule.enabled).map((rule) => ({ pattern: rule.pattern, mode: rule.mode }))
  const snapshot: PermissionPolicySnapshot = {
    enabled: true,
    whitelistedTools: [...policy.whitelistedTools],
    bashAllowRules: rules(policy.bashAllowRules),
    bashDenyRules: rules(policy.bashDenyRules)
  }
  if (
    snapshot.whitelistedTools.length === 0 &&
    snapshot.bashAllowRules.length === 0 &&
    snapshot.bashDenyRules.length === 0
  ) {
    return undefined
  }
  return snapshot
}

/** Commands whose second word narrows the suggestion (`git status`, `npm run`, ...). */
const MULTIWORD_COMMAND_HEADS = new Set([
  'git',
  'npm',
  'pnpm',
  'yarn',
  'bun',
  'cargo',
  'docker',
  'kubectl',
  'dotnet',
  'go',
  'pip',
  'pip3',
  'uv',
  'gh',
  'brew',
  'apt',
  'apt-get'
])

/** Suggest a wildcard allow-rule pattern for a command (used by the approval dialog quick-add). */
export function suggestBashRulePattern(command: string): string {
  const trimmed = command.trim()
  if (!trimmed) return ''
  const match = trimmed.match(/^(\S+)(\s+\S+)?/)
  if (!match) return trimmed
  const first = match[1]
  const second = match[2]
  const head =
    second && MULTIWORD_COMMAND_HEADS.has(first) && !second.trim().startsWith('-')
      ? match[0]
      : first
  return trimmed === head ? head : `${head} *`
}

function sanitizePermissionRule(value: unknown): PermissionRule | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const pattern = typeof record.pattern === 'string' ? record.pattern : ''
  if (!pattern.trim()) return null
  return {
    id: typeof record.id === 'string' && record.id.trim() ? record.id : createPermissionRuleId(),
    pattern,
    mode: record.mode === 'regex' ? 'regex' : 'wildcard',
    enabled: record.enabled !== false
  }
}

function sanitizePermissionRules(value: unknown): PermissionRule[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => sanitizePermissionRule(entry))
    .filter((rule): rule is PermissionRule => rule !== null)
}

export function sanitizePermissionPolicy(value: unknown): PermissionPolicy {
  if (!value || typeof value !== 'object') return { ...DEFAULT_PERMISSION_POLICY }
  const record = value as Record<string, unknown>
  const whitelistedTools = Array.isArray(record.whitelistedTools)
    ? Array.from(
        new Set(
          record.whitelistedTools
            .filter((entry): entry is string => typeof entry === 'string')
            .map((entry) => entry.trim())
            .filter(Boolean)
        )
      )
    : []
  return {
    enabled: record.enabled === true,
    whitelistedTools,
    bashAllowRules: sanitizePermissionRules(record.bashAllowRules),
    bashDenyRules: sanitizePermissionRules(record.bashDenyRules)
  }
}
