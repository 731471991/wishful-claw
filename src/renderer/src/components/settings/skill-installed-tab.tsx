import { useTranslation } from 'react-i18next'
import { Search, Loader2 } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import { cn } from '@renderer/lib/utils'
import type { ScanFileInfo } from '@renderer/stores/skills-store'
import { SkillDetail } from '@renderer/components/settings/skill-detail'
import { SkillEditor } from '@renderer/components/settings/skill-editor'

export interface InstalledTabProps {
  loading: boolean
  skills: { name: string; description: string; enabled: boolean }[]
  searchQuery: string
  onSearchChange: (v: string) => void
  selectedSkill: string | null
  onSelectSkill: (name: string | null) => void
  skillContent: string | null
  skillFiles: ScanFileInfo[]
  editing: boolean
  editContent: string | null
  onStartEdit: () => void
  onEditChange: (content: string) => void
  onCancelEdit: () => void
  onSave: () => void
  onDelete: (name: string) => Promise<void>
  onToggleEnabled: (name: string, enabled: boolean) => void
  onBack: () => void
}

export function InstalledTab(props: InstalledTabProps): React.JSX.Element {
  const { t } = useTranslation('settings')
  const {
    loading,
    skills,
    searchQuery,
    onSearchChange,
    selectedSkill,
    onSelectSkill,
    skillContent,
    skillFiles,
    editing,
    editContent,
    onStartEdit,
    onEditChange,
    onCancelEdit,
    onSave,
    onDelete,
    onToggleEnabled,
    onBack
  } = props

  if (selectedSkill && !editing) {
    return (
      <SkillDetail
        name={selectedSkill}
        content={skillContent}
        files={skillFiles}
        onEdit={onStartEdit}
        onDelete={() => onDelete(selectedSkill)}
        onBack={onBack}
      />
    )
  }

  if (selectedSkill && editing) {
    return (
      <SkillEditor
        name={selectedSkill}
        content={editContent ?? ''}
        onChange={onEditChange}
        onSave={onSave}
        onCancel={onCancelEdit}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative px-3 py-2 border-b shrink-0">
        <Search className="absolute left-5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('skills.installed.searchPlaceholder')}
          className="h-8 pl-8 text-xs"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            {t('skills.installed.loading')}
          </div>
        ) : skills.length === 0 ? (
          <div className="px-4 py-12 text-center text-xs text-muted-foreground">
            <p>{t('skills.installed.empty')}</p>
            <p className="mt-1 text-[10px] opacity-70">{t('skills.installed.emptyHint')}</p>
          </div>
        ) : (
          <div className="px-3 py-2">
            {skills.map((skill) => (
              <div
                key={skill.name}
                className={cn(
                  'flex items-start gap-2 rounded-lg border-b px-3 py-3 transition-colors',
                  selectedSkill === skill.name
                    ? 'bg-accent'
                    : 'hover:bg-muted/50',
                  !skill.enabled && 'opacity-50'
                )}
              >
                <button
                  onClick={() => onSelectSkill(skill.name)}
                  className="flex flex-1 flex-col items-start gap-0.5 text-left min-w-0"
                >
                  <span className="text-sm font-medium truncate w-full">{skill.name}</span>
                  <span className="text-xs text-muted-foreground line-clamp-2">
                    {skill.description}
                  </span>
                </button>
                <Switch
                  checked={skill.enabled}
                  onCheckedChange={(checked) => onToggleEnabled(skill.name, checked)}
                  className="scale-75 shrink-0 mt-0.5"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
