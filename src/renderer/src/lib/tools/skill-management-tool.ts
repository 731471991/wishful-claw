import type { ToolHandler } from './tool-types'
import { toolRegistry } from '../agent/tool-registry'
import { ipcClient } from '../ipc/ipc-client'
import { encodeStructuredToolResult, encodeToolError } from './tool-result-format'
import { refreshDynamicToolCatalog } from './dynamic-tool-catalog'

// --- Types matching the IPC contracts ---

interface InstalledSkillInfo {
  name: string
  description: string
  enabled?: boolean
}

interface MarketSkillInfo {
  id: string
  slug: string
  name: string
  description: string
  category?: string
  tags: string[]
  downloads: number
  updatedAt?: string
  url: string
  downloadUrl: string
  installCommand: string
}

// --- Tool 1: List installed skills ---

const listInstalledSkillsHandler: ToolHandler = {
  definition: {
    name: 'list_installed_skills',
    description: [
      'List all skills currently installed in the local skills directory.',
      '',
      'Returns each skill\u2019s name, description, and enabled status.',
      'Use this to check what is already installed before searching the marketplace or attempting installation.'
    ].join('\n'),
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  execute: async (_input, ctx) => {
    try {
      const result = await ctx.ipc.invoke('skills:list')
      const skills = Array.isArray(result) ? (result as InstalledSkillInfo[]) : []

      if (skills.length === 0) {
        return encodeStructuredToolResult({
          installed: [],
          count: 0,
          message: 'No skills are currently installed. Use search_skill_market to find skills to install.'
        })
      }

      const formatted = skills.map((s) => ({
        name: s.name,
        description: s.description,
        enabled: s.enabled !== false
      }))

      return encodeStructuredToolResult({
        installed: formatted,
        count: formatted.length
      })
    } catch (err) {
      return encodeToolError(`Failed to list installed skills: ${err instanceof Error ? err.message : String(err)}`)
    }
  },
  requiresApproval: () => false
}

// --- Tool 2: Search skill marketplace ---

const searchSkillMarketHandler: ToolHandler = {
  definition: {
    name: 'search_skill_market',
    description: [
      'Search the SkillHub marketplace for available skills.',
      '',
      'Returns matching skills with name, slug, description, category, tags, download count,',
      'and install command. Use the slug or name from the results to install via install_skill.',
      '',
      'Pass an empty query to browse popular/all skills.'
    ].join('\n'),
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search keyword (e.g. "search", "web", "git", "memory"). Pass empty string to browse all.'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return. Default 20.'
        }
      },
      required: []
    }
  },
  execute: async (input, ctx) => {
    try {
      const query = (input.query as string) ?? ''
      const limit = (input.limit as number) ?? 20

      // Lazy import to avoid circular dependency
      const { useSettingsStore } = await import('@renderer/stores/settings-store')
      const { skillsMarketApiKey } = useSettingsStore.getState()

      const result = await ctx.ipc.invoke('skills:market-list', {
        offset: 0,
        limit,
        query,
        provider: 'skillsmp',
        apiKey: skillsMarketApiKey
      })

      const typed = result as { total: number; skills: MarketSkillInfo[] }
      const skills = typed.skills ?? []

      if (skills.length === 0) {
        return encodeStructuredToolResult({
          results: [],
          total: 0,
          message: query
            ? `No skills found matching "${query}". Try a different keyword or browse all with an empty query.`
            : 'No skills available in the marketplace.'
        })
      }

      const formatted = skills.map((s) => ({
        name: s.name,
        slug: s.slug,
        description: s.description,
        category: s.category,
        tags: s.tags,
        downloads: s.downloads,
        installCommand: s.installCommand
      }))

      return encodeStructuredToolResult({
        results: formatted,
        total: typed.total ?? formatted.length,
        showing: formatted.length
      })
    } catch (err) {
      return encodeToolError(`Failed to search skill marketplace: ${err instanceof Error ? err.message : String(err)}`)
    }
  },
  requiresApproval: () => false
}

// --- Tool 3: Install a skill from the marketplace ---

const installSkillHandler: ToolHandler = {
  definition: {
    name: 'install_skill',
    description: [
      'Download and install a skill from the SkillHub marketplace.',
      '',
      'Provide the skill slug (from search_skill_market results) to download, scan, and install.',
      'The skill will be placed in the local skills directory and automatically registered.',
      '',
      'After installation, the skill becomes available via the Skill tool for the agent to load.'
    ].join('\n'),
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description: 'The skill slug from search_skill_market results (e.g. "web-composite-search").'
        },
        name: {
          type: 'string',
          description: 'The display name of the skill (optional, defaults to slug).'
        }
      },
      required: ['slug']
    }
  },
  execute: async (input, ctx) => {
    try {
      const slug = (input.slug as string)?.trim()
      if (!slug) {
        return encodeToolError('slug is required. Use search_skill_market to find the correct slug.')
      }
      const skillName = (input.name as string)?.trim() || slug

      // Get API key
      const { useSettingsStore } = await import('@renderer/stores/settings-store')
      const { skillsMarketApiKey } = useSettingsStore.getState()

      // Step 1: Download from marketplace
      const downloadResult = await ctx.ipc.invoke('skills:download-remote', {
        slug,
        name: skillName,
        provider: 'skillsmp',
        apiKey: skillsMarketApiKey,
        skillId: slug,
        url: '',
        downloadUrl: ''
      }) as { tempPath?: string; files?: { path: string; content: string }[]; error?: string }

      if (downloadResult.error || !downloadResult.tempPath) {
        return encodeToolError(
          `Download failed: ${downloadResult.error ?? 'Unknown error'}. ` +
          'Verify the slug is correct (use search_skill_market to find valid slugs).'
        )
      }

      // Step 2: Scan for security risks
      const scanResult = await ctx.ipc.invoke('skills:scan', {
        sourcePath: downloadResult.tempPath
      }) as { name?: string; description?: string; risks?: Array<{ severity: string; category: string; detail: string }>; error?: string }

      if ('error' in scanResult) {
        await ctx.ipc.invoke('skills:cleanup-temp', { tempPath: downloadResult.tempPath })
        return encodeToolError(`Security scan failed: ${scanResult.error}`)
      }

      // Check for dangerous risks
      const dangers = (scanResult.risks ?? []).filter((r) => r.severity === 'danger')
      if (dangers.length > 0) {
        await ctx.ipc.invoke('skills:cleanup-temp', { tempPath: downloadResult.tempPath })
        return encodeStructuredToolResult({
          success: false,
          reason: 'security_risk',
          dangers: dangers.map((d) => ({ category: d.category, detail: d.detail })),
          message: 'Installation aborted: dangerous security risks detected. Please review the skill manually before installing.'
        })
      }

      // Step 3: Install from the downloaded temp folder
      const installResult = await ctx.ipc.invoke('skills:add-from-folder', {
        sourcePath: downloadResult.tempPath
      }) as { success: boolean; name?: string; error?: string }

      // Cleanup temp regardless of install result
      await ctx.ipc.invoke('skills:cleanup-temp', { tempPath: downloadResult.tempPath })

      if (!installResult.success) {
        return encodeToolError(
          `Installation failed: ${installResult.error ?? 'Unknown error'}`
        )
      }

      // Refresh tool catalog so the new skill is registered
      await refreshDynamicToolCatalog()

      const warnings = (scanResult.risks ?? []).filter((r) => r.severity === 'warning')

      return encodeStructuredToolResult({
        success: true,
        name: installResult.name ?? skillName,
        slug,
        description: scanResult.description ?? '',
        warnings: warnings.map((w) => ({ category: w.category, detail: w.detail })),
        message: `Skill "${installResult.name ?? skillName}" has been installed successfully. It is now available via the Skill tool.`
      })
    } catch (err) {
      return encodeToolError(`Failed to install skill: ${err instanceof Error ? err.message : String(err)}`)
    }
  },
  requiresApproval: () => false
}

// --- Registration ---

export function registerSkillManagementTools(): void {
  toolRegistry.register(listInstalledSkillsHandler)
  toolRegistry.register(searchSkillMarketHandler)
  toolRegistry.register(installSkillHandler)
}

// Also export for ipcClient fallback (used when ctx.ipc is unavailable)
export { ipcClient }
