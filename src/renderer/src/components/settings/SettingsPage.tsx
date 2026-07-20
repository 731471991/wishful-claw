import { ArrowLeft, Server, Info } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { TooltipProvider } from '@renderer/components/ui/tooltip'
import { WindowControls } from '@renderer/components/layout/WindowControls'
import { useUIStore, type SettingsTab } from '@renderer/stores/ui-store'
import { ProviderPanel } from '@renderer/components/settings/ProviderPanel'
import { cn } from '@renderer/lib/utils'

const menuGroups: Array<{
  label: string
  items: { id: SettingsTab; icon: React.ReactNode; label: string; desc: string }[]
}> = [
  {
    label: 'AI 服务',
    items: [
      {
        id: 'provider',
        icon: <Server className="size-4" />,
        label: 'AI 服务商',
        desc: '配置 API Key、Base URL，测试连通性'
      }
    ]
  },
  {
    label: '关于',
    items: [
      {
        id: 'about',
        icon: <Info className="size-4" />,
        label: '关于',
        desc: '版本信息'
      }
    ]
  }
]

function AboutPanel(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-2xl px-8 pb-16 pt-10">
      <h1 className="mb-2 text-xl font-semibold">关于 Wishful Claw</h1>
      <p className="text-sm text-muted-foreground">版本: v0.2.0-dev</p>
      <div className="mt-6 space-y-3 text-sm text-muted-foreground">
        <p>
          Wishful Claw 是一个 AI Agent 编程助手，融合三个开源项目的优点：
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li>OpenCowork — Agent Loop / 工具链 / Provider / 架构</li>
          <li>KodaClaw — 记忆系统 / 人格系统设计</li>
          <li>OpenClaw — 记忆主动回忆机制</li>
        </ul>
      </div>
    </div>
  )
}

export function SettingsPage(): React.JSX.Element {
  const settingsTab = useUIStore((s) => s.settingsTab)
  const setSettingsTab = useUIStore((s) => s.setSettingsTab)
  const closeSettings = useUIStore((s) => s.closeSettings)

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full min-h-0 w-full flex-col bg-muted/10">
        {/* Header with back button + window controls */}
        <header className="relative flex h-10 shrink-0 items-center gap-3 border-b bg-background/90 px-3 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
            onClick={closeSettings}
            title="返回"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-foreground/92">设置</div>
          </div>
          <WindowControls />
        </header>

        {/* Body: sidebar + content */}
        <div className="flex min-h-0 flex-1">
          {/* Sidebar nav */}
          <div className="flex w-[236px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 pb-2 pt-4">
              {menuGroups.map((group) => (
                <div key={group.label} className="space-y-0.5">
                  <p className="mb-1 px-3 text-[11px] font-medium text-muted-foreground/70">
                    {group.label}
                  </p>
                  {group.items.map((item) => {
                    const active = settingsTab === item.id
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSettingsTab(item.id)}
                        className={cn(
                          'group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors duration-150',
                          active
                            ? 'font-medium text-sidebar-accent-foreground bg-sidebar-accent'
                            : 'text-muted-foreground hover:bg-sidebar-accent/55 hover:text-foreground'
                        )}
                      >
                        <span
                          className={cn(
                            'flex shrink-0 items-center justify-center transition-colors',
                            active
                              ? 'text-foreground'
                              : 'text-muted-foreground group-hover:text-foreground'
                          )}
                        >
                          {item.icon}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </nav>

            <div className="border-t border-sidebar-border/60 px-4 py-3 text-[11px] text-muted-foreground/55">
              Wishful Claw v0.2.0-dev
            </div>
          </div>

          {/* Content area */}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {settingsTab === 'provider' ? (
              <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
                <ProviderPanel />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <AboutPanel />
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
