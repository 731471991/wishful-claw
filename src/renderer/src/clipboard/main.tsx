import '../assets/main.css'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { Clipboard, Trash2, X, Settings, ArrowLeft, Keyboard } from 'lucide-react'
import { syncThemeFromSettings } from '../lib/theme-sync'

interface ClipboardEntry {
  id: string
  text: string
  timestamp: number
  preview: string
}

interface ClipboardConfig {
  enabled: boolean
  maxDays: number
  maxItems: number
  accelerator: string
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return Math.floor(diff / 86400000) + '天前'
}

/** Convert a browser KeyboardEvent into an Electron accelerator string. */
function toAccelerator(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.metaKey) parts.push('Super')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  const key = e.key
  const modifierKeys = ['Control', 'Meta', 'Alt', 'Shift']
  if (modifierKeys.includes(key)) return ''

  let keyName: string
  switch (key) {
    case ' ': keyName = 'Space'; break
    case 'ArrowUp': keyName = 'Up'; break
    case 'ArrowDown': keyName = 'Down'; break
    case 'ArrowLeft': keyName = 'Left'; break
    case 'ArrowRight': keyName = 'Right'; break
    case 'Enter': keyName = 'Return'; break
    case 'Escape': keyName = 'Escape'; break
    case 'Backspace': keyName = 'Backspace'; break
    case 'Tab': keyName = 'Tab'; break
    default:
      keyName = key.length === 1 ? key.toUpperCase() : key
  }
  parts.push(keyName)
  return parts.join('+')
}

function ClipboardEnhancer(): React.JSX.Element {
  const [history, setHistory] = useState<ClipboardEntry[]>([])
  const [config, setConfig] = useState<ClipboardConfig | null>(null)
  const [view, setView] = useState<'list' | 'settings'>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [capturingHotkey, setCapturingHotkey] = useState(false)
  const [hotkeyDraft, setHotkeyDraft] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void window.api.invoke<ClipboardEntry[]>('clipboard:get-history', null).then((h: ClipboardEntry[]) => {
      setHistory(h)
    })
    void window.api.invoke<ClipboardConfig>('clipboard:get-config', null).then((c: ClipboardConfig) => {
      setConfig(c)
    })

    const cleanup = window.api.on<ClipboardEntry[]>('clipboard:history-updated', (entries: ClipboardEntry[]) => {
      setHistory(entries)
    })
    return () => cleanup()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (capturingHotkey) {
          setCapturingHotkey(false)
          setHotkeyDraft('')
        } else if (view === 'settings') {
          setView('list')
        } else {
          void window.api.invoke('clipboard:hide', null)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [capturingHotkey, view])

  useEffect(() => {
    if (!capturingHotkey) return

    const handleCapture = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      const accel = toAccelerator(e)
      if (accel) {
        setHotkeyDraft(accel)
        setCapturingHotkey(false)
      }
    }
    window.addEventListener('keydown', handleCapture, true)
    return () => window.removeEventListener('keydown', handleCapture, true)
  }, [capturingHotkey])

  const handleCopy = useCallback(async (text: string): Promise<void> => {
    await window.api.invoke<boolean>('clipboard:copy', text)
  }, [])

  const handleDelete = useCallback(async (id: string): Promise<void> => {
    const updated = await window.api.invoke<ClipboardEntry[]>('clipboard:delete', id)
    setHistory(updated)
  }, [])

  const handleClear = useCallback(async (): Promise<void> => {
    const updated = await window.api.invoke<ClipboardEntry[]>('clipboard:clear', null)
    setHistory(updated)
  }, [])

  const updateConfig = useCallback(async (patch: Partial<ClipboardConfig>): Promise<void> => {
    const updated = await window.api.invoke<ClipboardConfig>('clipboard:update-config', patch)
    setConfig(updated)
  }, [])

  const handleSaveHotkey = useCallback(async (): Promise<void> => {
    if (hotkeyDraft) {
      await updateConfig({ accelerator: hotkeyDraft })
      setHotkeyDraft('')
    }
  }, [hotkeyDraft, updateConfig])

  const filteredHistory = searchQuery
    ? history.filter(
        (e) => e.text.toLowerCase().includes(searchQuery.toLowerCase()) || e.preview.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : history

  // ── Settings Panel ──
  if (view === 'settings') {
    return (
      <div className="flex h-screen w-screen flex-col overflow-hidden rounded-2xl border border-border bg-background/95 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <button
            onClick={() => setView('list')}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            返回
          </button>
          <span className="flex-1 text-sm font-medium text-foreground">剪贴板设置</span>
        </div>

        {/* Settings content */}
        <div className="flex-1 overflow-y-auto p-4">
          {config ? (
            <div className="space-y-5">
              {/* Enable / Disable */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">启用剪贴板增强</p>
                  <p className="text-[11px] text-muted-foreground">关闭后停止监听和快捷键</p>
                </div>
                <button
                  onClick={() => void updateConfig({ enabled: !config.enabled })}
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    config.enabled ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                      config.enabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Max days */}
              <div>
                <label className="mb-1.5 block text-sm text-foreground">过期时间（天）</label>
                <p className="mb-2 text-[11px] text-muted-foreground">超过此天数的记录将自动删除</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={config.maxDays}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1
                      void updateConfig({ maxDays: Math.max(1, Math.min(365, val)) })
                    }}
                    className="w-20 rounded-md border border-input bg-muted px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary/50"
                  />
                  <span className="text-xs text-muted-foreground">天</span>
                </div>
              </div>

              {/* Max items */}
              <div>
                <label className="mb-1.5 block text-sm text-foreground">最大记录数</label>
                <p className="mb-2 text-[11px] text-muted-foreground">超过此数量时自动清理最旧记录</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={10}
                    max={1000}
                    step={10}
                    value={config.maxItems}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 100
                      void updateConfig({ maxItems: Math.max(10, Math.min(1000, val)) })
                    }}
                    className="w-20 rounded-md border border-input bg-muted px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary/50"
                  />
                  <span className="text-xs text-muted-foreground">条</span>
                </div>
              </div>

              {/* Hotkey */}
              <div>
                <label className="mb-1.5 block text-sm text-foreground">唤起快捷键</label>
                <p className="mb-2 text-[11px] text-muted-foreground">点击下方按钮后按下新的快捷键组合</p>
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 items-center gap-2 rounded-md border border-input bg-muted px-3 py-1.5">
                    <Keyboard className="size-3.5 text-muted-foreground" />
                    {capturingHotkey ? (
                      <span className="flex-1 text-sm text-primary">请按下快捷键...</span>
                    ) : hotkeyDraft ? (
                      <span className="flex-1 text-sm text-amber-400">{hotkeyDraft}</span>
                    ) : (
                      <kbd className="flex-1 text-sm text-foreground">{config.accelerator}</kbd>
                    )}
                  </div>
                  {hotkeyDraft && !capturingHotkey && (
                    <button
                      onClick={() => void handleSaveHotkey()}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:opacity-90"
                    >
                      保存
                    </button>
                  )}
                  {capturingHotkey ? (
                    <button
                      onClick={() => {
                        setCapturingHotkey(false)
                        setHotkeyDraft('')
                      }}
                      className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
                    >
                      取消
                    </button>
                  ) : (
                    !hotkeyDraft && (
                      <button
                        onClick={() => setCapturingHotkey(true)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        修改
                      </button>
                    )
                  )}
                </div>
                {hotkeyDraft && !capturingHotkey && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">点击"保存"应用新快捷键</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">加载中...</div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <kbd className="rounded border border-border px-1 py-0.5">ESC</kbd> 返回列表
        </div>
      </div>
    )
  }

  // ── History List ──
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden rounded-2xl border border-border bg-background/95 shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Clipboard className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-sm font-medium text-foreground">剪贴板历史</span>
        <button
          onClick={() => setView('settings')}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Settings className="size-3" />
          设置
        </button>
        {history.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
          >
            <Trash2 className="size-3" />
            清空
          </button>
        )}
        <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
      </div>

      {/* Search */}
      {history.length > 0 && (
        <div className="px-3 py-2">
          <input
            ref={searchRef}
            type="text"
            placeholder="搜索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-input bg-muted px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
          />
        </div>
      )}

      {/* History list */}
      <div className="flex-1 overflow-y-auto">
        {filteredHistory.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Clipboard className="size-8 opacity-40" />
            <span className="text-xs">
              {searchQuery ? '无匹配结果' : '暂无剪贴板历史'}
            </span>
          </div>
        ) : (
          filteredHistory.map((entry) => (
            <div
              key={entry.id}
              onClick={() => void handleCopy(entry.text)}
              className="group cursor-pointer border-b border-border/50 px-4 py-3 transition-colors hover:bg-accent"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-xs leading-5 text-foreground">
                  {entry.preview}
                </p>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="text-[10px] text-muted-foreground">{formatTime(entry.timestamp)}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleDelete(entry.id)
                    }}
                    className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
        <span>{filteredHistory.length} 条记录</span>
        <span>{config?.accelerator ?? 'Ctrl+Shift+V'} 唤起</span>
      </div>
    </div>
  )
}

// Sync theme from main app settings before rendering to avoid flash
void syncThemeFromSettings().finally(() => {
  const root = createRoot(document.getElementById('root')!)
  root.render(<ClipboardEnhancer />)
})
