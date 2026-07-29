import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Wrench, FileText, MessageSquare } from 'lucide-react'
import { Separator } from '@renderer/components/ui/separator'
import type { McpTool, McpResource, McpPrompt } from '@renderer/lib/mcp/types'

type CapTab = 'tools' | 'resources' | 'prompts'

export function McpCapabilities({
  tools,
  resources,
  prompts
}: {
  tools: McpTool[]
  resources: McpResource[]
  prompts: McpPrompt[]
}): React.JSX.Element {
  const { t } = useTranslation('settings')
  const [capTab, setCapTab] = useState<CapTab>('tools')

  const tabConfig: Array<{ key: CapTab; count: number; Icon: typeof Wrench }> = [
    { key: 'tools', count: tools.length, Icon: Wrench },
    { key: 'resources', count: resources.length, Icon: FileText },
    { key: 'prompts', count: prompts.length, Icon: MessageSquare }
  ]

  return (
    <>
      <Separator className="mb-3" />
      <div className="flex items-center gap-1 mb-3">
        {tabConfig.map(({ key, count, Icon }) => (
          <button
            key={key}
            onClick={() => setCapTab(key)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors ${
              capTab === key
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-muted/60'
            }`}
          >
            <Icon className="size-3" />
            {key} ({count})
          </button>
        ))}
      </div>

      {capTab === 'tools' && (
        <div className="space-y-1">
          {tools.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">{t('mcp.noTools', { defaultValue: 'No tools available' })}</p>
          ) : (
            tools.map((tool) => (
              <div key={tool.name} className="rounded-md border px-2.5 py-2">
                <p className="text-xs font-medium font-mono">{tool.name}</p>
                {tool.description && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{tool.description}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {capTab === 'resources' && (
        <div className="space-y-1">
          {resources.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">{t('mcp.noResources', { defaultValue: 'No resources available' })}</p>
          ) : (
            resources.map((r) => (
              <div key={r.uri} className="rounded-md border px-2.5 py-2">
                <p className="text-xs font-medium">{r.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{r.uri}</p>
                {r.description && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{r.description}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {capTab === 'prompts' && (
        <div className="space-y-1">
          {prompts.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">{t('mcp.noPrompts', { defaultValue: 'No prompts available' })}</p>
          ) : (
            prompts.map((p) => (
              <div key={p.name} className="rounded-md border px-2.5 py-2">
                <p className="text-xs font-medium">{p.name}</p>
                {p.description && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{p.description}</p>
                )}
                {p.arguments && p.arguments.length > 0 && (
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                    Args: {p.arguments.map((a) => a.name).join(', ')}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </>
  )
}
