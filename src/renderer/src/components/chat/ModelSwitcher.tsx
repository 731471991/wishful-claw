import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface ProviderModel {
  providerId: string
  providerName: string
  model: string
}

export function ModelSwitcher() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<ProviderModel | null>(null)
  const [models, setModels] = useState<ProviderModel[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Load providers from the store
    loadProviders()
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const loadProviders = async () => {
    try {
      const result = await window.api.workerRequest<{ providers: Array<Record<string, unknown>> }>(
        'provider/list',
        {}
      )
      const list: ProviderModel[] = []
      for (const p of result.providers ?? []) {
        const id = String(p.id ?? '')
        const name = String(p.name ?? p.id ?? 'Unknown')
        const model = String(p.model ?? '')
        const enabled = p.enabled !== false
        if (id && model && enabled) {
          list.push({ providerId: id, providerName: name, model })
        }
      }
      setModels(list)
      if (list.length > 0 && !selected) {
        selectModel(list[0])
      }
    } catch {
      // ignore
    }
  }

  const selectModel = (m: ProviderModel) => {
    setSelected(m)
    setOpen(false)
    // Store selection globally for InputArea to use
    window.__selectedProvider = {
      providerId: m.providerId,
      model: m.model,
      type: 'openai-chat',
      apiKey: '',
      baseUrl: ''
    }
    // Re-fetch full provider config
    fetchProviderConfig(m.providerId)
  }

  const fetchProviderConfig = async (providerId: string) => {
    try {
      const result = await window.api.workerRequest<Record<string, unknown>>(
        'provider/get',
        { id: providerId }
      )
      if (result && typeof result === 'object') {
        window.__selectedProvider = result
      }
    } catch {
      // ignore
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-xs hover:bg-accent transition-colors min-w-[120px]"
      >
        <span className="truncate flex-1 text-left">
          {selected ? selected.model : 'Select model'}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 left-0 z-50 w-64 rounded-lg border border-border bg-popover shadow-md max-h-64 overflow-y-auto">
          {models.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">No providers configured</div>
          ) : (
            models.map((m) => (
              <button
                key={`${m.providerId}-${m.model}`}
                onClick={() => selectModel(m)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors',
                  selected?.providerId === m.providerId && selected?.model === m.model && 'bg-accent'
                )}
              >
                <div className="flex flex-col items-start min-w-0">
                  <span className="truncate font-medium">{m.model}</span>
                  <span className="text-muted-foreground truncate">{m.providerName}</span>
                </div>
                {selected?.providerId === m.providerId && selected?.model === m.model && (
                  <Check className="h-3 w-3 shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
