import { useCallback, useEffect, useState } from 'react'
import { Keyboard, Plus, Trash2 } from 'lucide-react'

interface MultiShortcutEditorProps {
  accelerators: string[]
  onChange: (accelerators: string[]) => Promise<void> | void
  label: string
  description: string
  recordingLabel?: string
  saveLabel?: string
  cancelLabel?: string
  modifyLabel?: string
  addLabel?: string
  disabled?: boolean
}

interface ShortcutDraft {
  index: number
  accelerator: string
}

function toAccelerator(event: KeyboardEvent): string {
  const parts: string[] = []
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.metaKey) parts.push('Super')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')

  if (['Control', 'Meta', 'Alt', 'Shift'].includes(event.key)) return ''

  let keyName: string
  switch (event.key) {
    case ' ': keyName = 'Space'; break
    case 'ArrowUp': keyName = 'Up'; break
    case 'ArrowDown': keyName = 'Down'; break
    case 'ArrowLeft': keyName = 'Left'; break
    case 'ArrowRight': keyName = 'Right'; break
    case 'Enter': keyName = 'Return'; break
    case 'Escape': keyName = 'Escape'; break
    case 'Backspace': keyName = 'Backspace'; break
    case 'Tab': keyName = 'Tab'; break
    default: keyName = event.key.length === 1 ? event.key.toUpperCase() : event.key
  }
  parts.push(keyName)
  return parts.join('+')
}

function MultiShortcutEditor({
  accelerators,
  onChange,
  label,
  description,
  recordingLabel = '请按下快捷键...',
  saveLabel = '保存',
  cancelLabel = '取消',
  modifyLabel = '修改',
  addLabel = '添加快捷键',
  disabled = false
}: MultiShortcutEditorProps): React.JSX.Element {
  const [recordingIndex, setRecordingIndex] = useState<number | null>(null)
  const [draft, setDraft] = useState<ShortcutDraft | null>(null)

  useEffect(() => {
    if (disabled) {
      setRecordingIndex(null)
      setDraft(null)
    }
  }, [disabled])

  useEffect(() => {
    if (disabled || recordingIndex === null) return
    const handleCapture = (event: KeyboardEvent): void => {
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.key === 'Escape') {
        setRecordingIndex(null)
        return
      }
      const accelerator = toAccelerator(event)
      if (!accelerator) return
      setDraft({ index: recordingIndex, accelerator })
      setRecordingIndex(null)
    }
    window.addEventListener('keydown', handleCapture, true)
    return () => window.removeEventListener('keydown', handleCapture, true)
  }, [disabled, recordingIndex])

  const startCapture = useCallback((index: number): void => {
    setDraft(null)
    setRecordingIndex(index)
  }, [])

  const saveDraft = useCallback(async (): Promise<void> => {
    if (!draft) return
    const next = [...accelerators]
    if (draft.index < next.length) next[draft.index] = draft.accelerator
    else next.push(draft.accelerator)
    const deduplicated = next.filter((value, index) => next.indexOf(value) === index)
    await onChange(deduplicated)
    setDraft(null)
  }, [accelerators, draft, onChange])

  const removeShortcut = useCallback(async (index: number): Promise<void> => {
    if (accelerators.length <= 1) return
    await onChange(accelerators.filter((_, itemIndex) => itemIndex !== index))
    setDraft(null)
    setRecordingIndex(null)
  }, [accelerators, onChange])

  return (
    <fieldset disabled={disabled} className={disabled ? 'opacity-50' : undefined}>
      <label className="mb-1.5 block text-sm text-foreground">{label}</label>
      <p className="mb-2 text-[11px] text-muted-foreground">{description}</p>
      <div className="space-y-1.5">
        {accelerators.map((accelerator, index) => {
          const rowDraft = draft?.index === index ? draft : null
          return (
            <div key={`${accelerator}-${index}`} className="flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-md border border-input bg-muted px-3 py-1.5">
                <Keyboard className="size-3.5 text-muted-foreground" />
                <span className={`flex-1 text-sm ${recordingIndex === index ? 'text-primary' : rowDraft ? 'text-amber-400' : 'text-foreground'}`}>
                  {recordingIndex === index ? recordingLabel : rowDraft?.accelerator ?? accelerator}
                </span>
              </div>
              {rowDraft ? (
                <>
                  <button onClick={() => void saveDraft()} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
                    {saveLabel}
                  </button>
                  <button onClick={() => setDraft(null)} className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent">
                    {cancelLabel}
                  </button>
                </>
              ) : recordingIndex === index ? (
                <button onClick={() => setRecordingIndex(null)} className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent">
                  {cancelLabel}
                </button>
              ) : (
                <button onClick={() => startCapture(index)} className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
                  {modifyLabel}
                </button>
              )}
              {accelerators.length > 1 && recordingIndex !== index && !rowDraft && (
                <button onClick={() => void removeShortcut(index)} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive" aria-label="删除快捷键">
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>
          )
        })}

        {recordingIndex === accelerators.length && (
          <div className="flex items-center gap-2 rounded-md border border-input bg-muted px-3 py-1.5">
            <Keyboard className="size-3.5 text-muted-foreground" />
            <span className="flex-1 text-sm text-primary">{recordingLabel}</span>
            <button onClick={() => setRecordingIndex(null)} className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent">
              {cancelLabel}
            </button>
          </div>
        )}

        {draft?.index === accelerators.length && (
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-md border border-input bg-muted px-3 py-1.5">
              <Keyboard className="size-3.5 text-muted-foreground" />
              <span className="flex-1 text-sm text-amber-400">{draft.accelerator}</span>
            </div>
            <button onClick={() => void saveDraft()} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
              {saveLabel}
            </button>
            <button onClick={() => setDraft(null)} className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent">
              {cancelLabel}
            </button>
          </div>
        )}

        {recordingIndex === null && !draft && (
          <button onClick={() => startCapture(accelerators.length)} className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
            <Plus className="size-3" />
            {addLabel}
          </button>
        )}
      </div>
    </fieldset>
  )
}

export { MultiShortcutEditor }
