import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Keyboard } from 'lucide-react'

interface ShortcutConfig {
  enabled: boolean
  accelerator: string
  shortcutRegistered?: boolean
}

/** Convert a browser KeyboardEvent into an Electron accelerator string. */
function toAccelerator(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.metaKey) parts.push('Super')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  const modifierKeys = ['Control', 'Meta', 'Alt', 'Shift']
  if (modifierKeys.includes(e.key)) return ''

  let keyName: string
  switch (e.key) {
    case ' ': keyName = 'Space'; break
    case 'ArrowUp': keyName = 'Up'; break
    case 'ArrowDown': keyName = 'Down'; break
    case 'ArrowLeft': keyName = 'Left'; break
    case 'ArrowRight': keyName = 'Right'; break
    case 'Enter': keyName = 'Return'; break
    case 'Escape': keyName = 'Escape'; break
    case 'Backspace': keyName = 'Backspace'; break
    case 'Tab': keyName = 'Tab'; break
    default: keyName = e.key.length === 1 ? e.key.toUpperCase() : e.key
  }
  parts.push(keyName)
  return parts.join('+')
}

type Target = 'clipboard' | 'launcher'

type RowState = 'idle' | 'recording' | 'draft'

interface RowDraft {
  target: Target
  draft: string
}

function ShortcutRow({
  label,
  accelerator,
  state,
  draft,
  t,
  onStartCapture,
  onSave,
  onCancel
}: {
  label: string
  accelerator: string
  state: RowState
  draft: string
  t: (key: string, opts?: Record<string, unknown>) => string
  onStartCapture: () => void
  onSave: () => void
  onCancel: () => void
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2.5">
        <Keyboard className="size-4 text-muted-foreground" />
        <span className="text-sm text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {state === 'recording' ? (
          <span className="text-xs text-primary">{t('shortcuts.recording', { defaultValue: 'Press keys...' })}</span>
        ) : state === 'draft' ? (
          <>
            <kbd className="rounded border border-border bg-muted px-2.5 py-1 text-xs text-amber-500">{draft}</kbd>
            <button
              onClick={onSave}
              className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              {t('shortcuts.save', { defaultValue: 'Save' })}
            </button>
            <button
              onClick={onCancel}
              className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent"
            >
              {t('shortcuts.cancel', { defaultValue: 'Cancel' })}
            </button>
          </>
        ) : (
          <>
            <kbd className="rounded border border-border bg-muted px-2.5 py-1 text-xs text-foreground">{accelerator || '—'}</kbd>
            <button
              onClick={onStartCapture}
              className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {t('shortcuts.modify', { defaultValue: 'Modify' })}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function ShortcutsPanel(): React.JSX.Element {
  const { t } = useTranslation('settings')
  const [clipboardShortcut, setClipboardShortcut] = useState('')
  const [launcherShortcut, setLauncherShortcut] = useState('')
  // recordingTarget !== null means we're capturing keys for that target
  const [recordingTarget, setRecordingTarget] = useState<Target | null>(null)
  // After capture, the draft is stored here with its target
  const [draftInfo, setDraftInfo] = useState<RowDraft | null>(null)
  const [shortcutError, setShortcutError] = useState('')

  useEffect(() => {
    let cancelled = false
    void window.api.invoke<ShortcutConfig>('clipboard:get-config', null).then((cfg) => {
      if (cancelled) return
      setClipboardShortcut(cfg.accelerator)
    })
    void window.api.invoke<ShortcutConfig>('launcher:get-config', null).then((cfg) => {
      if (cancelled) return
      setLauncherShortcut(cfg.accelerator)
    })
    return () => { cancelled = true }
  }, [])

  // Keydown listener for capturing shortcuts
  useEffect(() => {
    if (!recordingTarget) return
    const handleCapture = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setRecordingTarget(null)
        return
      }
      const accel = toAccelerator(e)
      if (accel) {
        setDraftInfo({ target: recordingTarget, draft: accel })
        setRecordingTarget(null)
      }
    }
    window.addEventListener('keydown', handleCapture, true)
    return () => window.removeEventListener('keydown', handleCapture, true)
  }, [recordingTarget])

  const startCapture = useCallback((target: Target): void => {
    setDraftInfo(null)
    setShortcutError('')
    setRecordingTarget(target)
  }, [])

  const handleSave = useCallback(async (): Promise<void> => {
    if (!draftInfo) return
    const { target, draft } = draftInfo
    try {
      setShortcutError('')
      if (target === 'clipboard') {
        const cfg = await window.api.invoke<ShortcutConfig>('clipboard:update-config', { accelerator: draft })
        setClipboardShortcut(cfg.accelerator)
        if (cfg.shortcutRegistered === false) {
          setShortcutError(t('shortcuts.registerFailed', { defaultValue: 'Shortcut registration failed — it may be occupied by another application. Please try a different combination.' }))
        }
      } else {
        const cfg = await window.api.invoke<ShortcutConfig>('launcher:update-config', { accelerator: draft })
        setLauncherShortcut(cfg.accelerator)
        if (cfg.shortcutRegistered === false) {
          setShortcutError(t('shortcuts.registerFailed', { defaultValue: 'Shortcut registration failed — it may be occupied by another application. Please try a different combination.' }))
        }
      }
    } catch (err) {
      console.error('[ShortcutsPanel] Failed to save shortcut:', err)
    }
    setDraftInfo(null)
  }, [draftInfo])

  const handleCancel = useCallback((): void => {
    setDraftInfo(null)
  }, [])

  const getRowState = useCallback((target: Target): RowState => {
    if (recordingTarget === target) return 'recording'
    if (draftInfo && draftInfo.target === target) return 'draft'
    return 'idle'
  }, [recordingTarget, draftInfo])

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-8 pb-16 pt-10">
      {/* Title */}
      <div>
        <h2 className="text-lg font-semibold">{t('shortcuts.title', { defaultValue: 'Shortcuts' })}</h2>
        <p className="text-sm text-muted-foreground">{t('shortcuts.desc', { defaultValue: 'Configure global shortcuts for clipboard and launcher' })}</p>
      </div>

      {/* Shortcut rows */}
      <section className="space-y-3">
        <ShortcutRow
          label={t('shortcuts.clipboard', { defaultValue: 'Clipboard Enhancer' })}
          accelerator={clipboardShortcut}
          state={getRowState('clipboard')}
          draft={draftInfo?.target === 'clipboard' ? draftInfo.draft : ''}
          t={t}
          onStartCapture={() => startCapture('clipboard')}
          onSave={() => void handleSave()}
          onCancel={handleCancel}
        />
        <ShortcutRow
          label={t('shortcuts.launcher', { defaultValue: 'Quick Launcher' })}
          accelerator={launcherShortcut}
          state={getRowState('launcher')}
          draft={draftInfo?.target === 'launcher' ? draftInfo.draft : ''}
          t={t}
          onStartCapture={() => startCapture('launcher')}
          onSave={() => void handleSave()}
          onCancel={handleCancel}
        />
      </section>

      {/* Error message */}
      {shortcutError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          <p className="text-xs text-destructive">{shortcutError}</p>
        </div>
      )}

      {/* Hint */}
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          {t('shortcuts.hint', { defaultValue: 'Click "Modify" then press the desired key combination. Press ESC to cancel recording. Changes take effect immediately and sync with the clipboard window settings.' })}
        </p>
      </div>
    </div>
  )
}

export { ShortcutsPanel }
