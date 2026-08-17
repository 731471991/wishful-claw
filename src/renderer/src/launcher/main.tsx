import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { Search, CornerDownLeft } from 'lucide-react'

interface AppShortcut {
  name: string
  path: string
  iconPath?: string
}

function QuickLauncher(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AppShortcut[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const doSearch = useCallback(async (q: string): Promise<void> => {
    const apps = await window.api.invoke<AppShortcut[]>('launcher:search', q)
    setResults(apps as AppShortcut[])
    setSelectedIndex(0)
  }, [])

  const handleLaunch = useCallback(async (app: AppShortcut): Promise<void> => {
    await window.api.invoke<boolean>('launcher:launch', app.path)
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
    doSearch('')
  }, [doSearch])

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 120)
    return () => clearTimeout(timer)
  }, [query, doSearch])

  useEffect(() => {
    const selected = listRef.current?.children[selectedIndex] as HTMLElement
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIndex]) {
        handleLaunch(results[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      setQuery('')
      doSearch('')
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/95 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <Search className="size-4 shrink-0 text-zinc-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="搜索应用..."
          className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          autoFocus
        />
        <kbd className="shrink-0 rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-600">
          ESC
        </kbd>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto py-1">
        {results.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-zinc-600">
            无搜索结果
          </div>
        ) : (
          results.map((app, index) => (
            <div
              key={app.path}
              onClick={() => handleLaunch(app)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={
                'flex cursor-pointer items-center gap-3 px-4 py-2 text-sm transition-colors ' +
                (index === selectedIndex
                  ? 'bg-blue-600/20 text-blue-300'
                  : 'text-zinc-300 hover:bg-white/5')
              }
            >
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xs text-zinc-400">
                {app.name.charAt(0).toUpperCase()}
              </div>
              <span className="min-w-0 flex-1 truncate">{app.name}</span>
              {index === selectedIndex && (
                <CornerDownLeft className="size-3 shrink-0 text-zinc-600" />
              )}
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-[10px] text-zinc-600">
        <span>{'\u2191\u2193'} 选择 {'\u00b7'} Enter 启动</span>
        <span>WishfulClaw Quick Launcher</span>
      </div>
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<QuickLauncher />)
