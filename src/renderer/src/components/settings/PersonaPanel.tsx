import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Sparkles } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { usePersonaStore } from '@renderer/stores/persona-store'
import type { PersonaConfig } from '@renderer/lib/persona/persona-types'
import { PersonaList } from './persona/PersonaList'
import { PersonaEditor } from './persona/PersonaEditor'

export function PersonaPanel(): React.JSX.Element {
  const { t } = useTranslation('settings')
  const {
    personas,
    selectedPersona,
    loading,
    error,
    isNew,
    listPersonas,
    selectPersona,
    startNewPersona,
    savePersona,
    deletePersona,
    clearError
  } = usePersonaStore()

  const [draft, setDraft] = useState<PersonaConfig | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listPersonas()
  }, [listPersonas])

  useEffect(() => {
    if (selectedPersona) {
      setDraft({ ...selectedPersona })
      setDirty(false)
    } else {
      setDraft(null)
      setDirty(false)
    }
  }, [selectedPersona])

  const handleFieldChange = useCallback((field: keyof PersonaConfig, value: string) => {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev))
    setDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!draft) return
    setSaving(true)
    await savePersona(draft)
    setSaving(false)
  }, [draft, savePersona])

  const handleReset = useCallback(() => {
    if (selectedPersona) {
      setDraft({ ...selectedPersona })
      setDirty(false)
    }
  }, [selectedPersona])

  const handleSelectPersona = useCallback(
    (id: string) => {
      if (dirty && draft) {
        const ok = window.confirm(t('persona.unsavedConfirm', { defaultValue: '有未保存的更改，确定切换吗？' }))
        if (!ok) return
      }
      selectPersona(id)
    },
    [dirty, draft, selectPersona, t]
  )

  const handleNewPersona = useCallback(() => {
    if (dirty && draft) {
      const ok = window.confirm(t('persona.unsavedConfirm', { defaultValue: '有未保存的更改，确定切换吗？' }))
      if (!ok) return
    }
    startNewPersona()
  }, [dirty, draft, startNewPersona, t])

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold">{t('persona.title', { defaultValue: '人格管理' })}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t('persona.subtitle', { defaultValue: '管理全局人格库，编辑人格的身份、灵魂、认知和行为准则' })}
          </p>
        </div>
        <Button size="sm" variant="default" onClick={handleNewPersona}>
          <Plus className="mr-1.5 size-4" />
          {t('persona.newPersona', { defaultValue: '新建人格' })}
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex shrink-0 items-center justify-between border-b border-destructive/30 bg-destructive/10 px-6 py-2 text-sm text-destructive">
          <span>{error}</span>
          <Button size="sm" variant="ghost" onClick={clearError}>
            {t('persona.dismiss', { defaultValue: '关闭' })}
          </Button>
        </div>
      )}

      {/* Body: list + editor */}
      <div className="flex min-h-0 flex-1">
        {/* Persona list sidebar */}
        <div className="flex w-[240px] shrink-0 flex-col border-r">
          <div className="flex-1 overflow-y-auto p-2">
            <PersonaList
              personas={personas}
              loading={loading}
              selectedId={draft?.id ?? ''}
              isNew={isNew}
              onSelect={handleSelectPersona}
            />
          </div>
        </div>

        {/* Editor panel */}
        {!draft ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Sparkles className="size-8 opacity-40" />
            <p className="text-sm">
              {t('persona.selectHint', { defaultValue: '从左侧选择一个人格，或点击「新建人格」' })}
            </p>
          </div>
        ) : (
          <PersonaEditor
            draft={draft}
            dirty={dirty}
            isNew={isNew}
            saving={saving}
            onChange={handleFieldChange}
            onSave={handleSave}
            onReset={handleReset}
            onDelete={deletePersona}
          />
        )}
      </div>
    </div>
  )
}
