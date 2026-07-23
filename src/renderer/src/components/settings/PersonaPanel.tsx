import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { User, Plus, Trash2, Save, RotateCcw, Sparkles } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Textarea } from '@renderer/components/ui/textarea'
import { Input } from '@renderer/components/ui/input'
import { Spinner } from '@renderer/components/ui/spinner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@renderer/components/ui/alert-dialog'
import { usePersonaStore } from '@renderer/stores/persona-store'
import {
  PERSONA_FILES,
  type PersonaConfig,
  type PersonaFileKey
} from '@renderer/lib/persona/persona-types'
import { cn } from '@renderer/lib/utils'

type ActiveTab = PersonaFileKey

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

  const [activeTab, setActiveTab] = useState<ActiveTab>('identityMarkdown')
  const [draft, setDraft] = useState<PersonaConfig | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const lastLoadedId = useRef<string | null>(null)

  // Load persona list on mount
  useEffect(() => {
    listPersonas()
  }, [listPersonas])

  // Sync draft when selectedPersona changes
  useEffect(() => {
    if (selectedPersona) {
      // Deep copy to draft
      setDraft({ ...selectedPersona })
      setDirty(false)
      lastLoadedId.current = selectedPersona.id
      // Reset to first tab
      setActiveTab('identityMarkdown')
    } else {
      setDraft(null)
      setDirty(false)
    }
  }, [selectedPersona])

  const handleFieldChange = useCallback(
    (field: keyof PersonaConfig, value: string) => {
      setDraft((prev) => {
        if (!prev) return prev
        return { ...prev, [field]: value }
      })
      setDirty(true)
    },
    []
  )

  const handleSave = useCallback(async () => {
    if (!draft) return
    setSaving(true)
    const result = await savePersona(draft)
    setSaving(false)
    if (!result.success) {
      // Error is set in store
    }
  }, [draft, savePersona])

  const handleReset = useCallback(() => {
    if (selectedPersona) {
      setDraft({ ...selectedPersona })
      setDirty(false)
    }
  }, [selectedPersona])

  const handleDelete = useCallback(
    async (id: string) => {
      await deletePersona(id)
    },
    [deletePersona]
  )

  const handleSelectPersona = useCallback(
    (id: string) => {
      if (dirty && draft) {
        // Warn about unsaved changes
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
            {loading && personas.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Spinner className="size-5" />
              </div>
            ) : personas.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                {t('persona.empty', { defaultValue: '暂无人格' })}
              </div>
            ) : (
              <div className="space-y-1">
                {personas.map((p) => {
                  const isActive = (draft?.id || '') === p.id && !isNew
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPersona(p.id)}
                      className={cn(
                        'group flex w-full flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors',
                        isActive
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <User className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                          {p.name}
                        </span>
                        {p.isBuiltin && (
                          <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
                            {t('persona.builtin', { defaultValue: '内置' })}
                          </Badge>
                        )}
                      </div>
                      {p.tagline && (
                        <p className="truncate pl-5 text-[11px] text-muted-foreground/70">
                          {p.tagline}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Editor panel */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {!draft ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
              <Sparkles className="size-8 opacity-40" />
              <p className="text-sm">
                {t('persona.selectHint', { defaultValue: '从左侧选择一个人格，或点击「新建人格」' })}
              </p>
            </div>
          ) : (
            <>
              {/* Meta fields */}
              <div className="shrink-0 space-y-3 border-b px-6 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t('persona.fieldName', { defaultValue: '名称' })}
                    </label>
                    <Input
                      value={draft.name}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                      placeholder={t('persona.namePlaceholder', { defaultValue: '人格名称' })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t('persona.fieldTagline', { defaultValue: '标语' })}
                    </label>
                    <Input
                      value={draft.tagline}
                      onChange={(e) => handleFieldChange('tagline', e.target.value)}
                      placeholder={t('persona.taglinePlaceholder', { defaultValue: '一句话描述' })}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t('persona.fieldDescription', { defaultValue: '描述' })}
                  </label>
                  <Input
                    value={draft.description}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    placeholder={t('persona.descriptionPlaceholder', { defaultValue: '更详细的描述' })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {/* Tab bar */}
              <div className="flex shrink-0 items-center gap-1 border-b px-6 py-2">
                {PERSONA_FILES.map((file) => (
                  <button
                    key={file.key}
                    onClick={() => setActiveTab(file.key)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                      activeTab === file.key
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    )}
                  >
                    {file.label}
                  </button>
                ))}
              </div>

              {/* Active file description */}
              <div className="shrink-0 px-6 pt-3">
                <p className="text-[11px] text-muted-foreground/70">
                  {PERSONA_FILES.find((f) => f.key === activeTab)?.description}
                </p>
              </div>

              {/* Markdown editor */}
              <div className="min-h-0 flex-1 px-6 py-3">
                <Textarea
                  value={draft[activeTab] as string}
                  onChange={(e) => handleFieldChange(activeTab, e.target.value)}
                  className="h-full min-h-[200px] resize-none font-mono text-[13px] leading-relaxed"
                  placeholder={t('persona.editorPlaceholder', { defaultValue: '在此编写 Markdown 内容...' })}
                />
              </div>

              {/* Action bar */}
              <div className="flex shrink-0 items-center justify-between border-t px-6 py-3">
                <div className="flex items-center gap-2">
                  {isNew ? (
                    <Badge variant="outline" className="text-[11px]">
                      {t('persona.newBadge', { defaultValue: '新建' })}
                    </Badge>
                  ) : draft.isBuiltin ? (
                    <Badge variant="secondary" className="text-[11px]">
                      {t('persona.builtin', { defaultValue: '内置' })}
                    </Badge>
                  ) : null}
                  {dirty && (
                    <span className="text-[11px] text-amber-500">
                      {t('persona.unsaved', { defaultValue: '未保存' })}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleReset}
                    disabled={!dirty || saving}
                  >
                    <RotateCcw className="mr-1.5 size-3.5" />
                    {t('persona.reset', { defaultValue: '重置' })}
                  </Button>

                  {!isNew && !draft.isBuiltin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                          <Trash2 className="mr-1.5 size-3.5" />
                          {t('persona.delete', { defaultValue: '删除' })}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {t('persona.deleteConfirmTitle', { defaultValue: '删除人格' })}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('persona.deleteConfirmDesc', { defaultValue: '确定要删除「{{name}}」吗？此操作不可撤销。', name: draft.name })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            {t('persona.cancel', { defaultValue: '取消' })}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(draft.id)}
                            className="bg-destructive text-white hover:bg-destructive/90"
                          >
                            {t('persona.confirmDelete', { defaultValue: '删除' })}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}

                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleSave}
                    disabled={!dirty || saving}
                  >
                    {saving ? (
                      <Spinner className="mr-1.5 size-3.5" />
                    ) : (
                      <Save className="mr-1.5 size-3.5" />
                    )}
                    {t('persona.save', { defaultValue: '保存' })}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
