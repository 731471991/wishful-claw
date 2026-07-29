import { useTranslation } from 'react-i18next'
import { X, Save } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'

export interface SkillEditorProps {
  name: string
  content: string
  onChange: (content: string) => void
  onSave: () => void
  onCancel: () => void
}

export function SkillEditor({
  name,
  content,
  onChange,
  onSave,
  onCancel
}: SkillEditorProps): React.JSX.Element {
  const { t } = useTranslation('settings')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2 shrink-0">
        <h3 className="text-sm font-semibold flex-1 truncate">
          {t('skills.installed.editTitle', { name })}
        </h3>
        <Button variant="ghost" size="icon-sm" className="size-7" onClick={onCancel}>
          <X className="size-3.5" />
        </Button>
        <Button variant="default" size="sm" className="gap-1.5 text-xs" onClick={onSave}>
          <Save className="size-3" />
          {t('skills.installed.save')}
        </Button>
      </div>
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-h-0 resize-none border-0 bg-background p-4 font-mono text-xs leading-relaxed focus:outline-none"
        spellCheck={false}
      />
    </div>
  )
}
