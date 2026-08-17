import React, { useState, useEffect, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { Clipboard, Trash2, X } from 'lucide-react'

interface ClipboardEntry {
  id: string
  text: string
  timestamp: number
  preview: string
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return Math.floor(diff / 86400000) + '天前'
}

function ClipboardEnhancer(): React.JSX.Element {
  const [history, setHistory] = useState<ClipboardEntry[]>([])

  useEffect(() => {
    // Load history on mount
    void window.api.invoke<ClipboardEntry[]>('clipboard:get-history', null).then((h: ClipboardEntry[]) => {
      setHistory(h)
    })

    // Listen for updates
    const cleanup = window.api.on<ClipboardEntry[]>('clipboard:history-updated', (entries: ClipboardEntry[]) => {
      setHistory(entries)
    })
    return () => cleanup()
  }, [])

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

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/95 shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <Clipboard className="size-4 shrink-0 text-zinc-400" />
        <span className="flex-1 text-sm font-medium text-zinc-200">剪贴板历史</span>
        {history.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-red-400"
          >
            <Trash2 className="size-3" />
            清空
          </button>
        )}
        <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-600">
          ESC
        </kbd>
      </div>

      {/* History list */}
      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-600">
            <Clipboard className="size-8 opacity-40" />
            <span className="text-xs">暂无剪贴板历史</span>
          </div>
        ) : (
          history.map((entry) => (
            <div
              key={entry.id}
              onClick={() => handleCopy(entry.text)}
              className="group cursor-pointer border-b border-white/5 px-4 py-3 transition-colors hover:bg-white/5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-xs leading-5 text-zinc-300">
                  {entry.preview}
                </p>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="text-[10px] text-zinc-600">{formatTime(entry.timestamp)}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleDelete(entry.id)
                    }}
                    className="rounded p-0.5 text-zinc-600 hover:text-red-400"
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
      <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-[10px] text-zinc-600">
        <span>{history.length} 条记录</span>
        <span>Ctrl+Shift+V 唤起</span>
      </div>
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<ClipboardEnhancer />)
