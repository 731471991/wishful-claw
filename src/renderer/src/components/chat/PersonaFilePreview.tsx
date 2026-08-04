import { useCallback, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import {
  type PersonaSummary,
  PERSONA_FILE_NAMES,
  joinFsPath,
  readTextFile
} from './project-archive-helpers'

export function PersonaFilePreview({
  persona
}: {
  persona: PersonaSummary
}): React.JSX.Element {
  const { t } = useTranslation('chat')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSelectFile = useCallback(
    async (fileName: string) => {
      setSelectedFile(fileName)
      setLoading(true)
      const filePath = joinFsPath(persona.files.find((f) => f.name === fileName)?.path ?? '')
      if (!filePath) {
        setFileContent('(file not found)')
        setLoading(false)
        return
      }
      const result = await readTextFile(filePath)
      setFileContent(result.content ?? `(error: ${result.error})`)
      setLoading(false)
    },
    [persona.files]
  )

  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
      <div className="w-48 shrink-0 space-y-1">
        {PERSONA_FILE_NAMES.map((name) => {
          const exists = persona.files.some((f) => f.name === name)
          return (
            <Button
              key={name}
              variant={selectedFile === name ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                'w-full justify-start text-xs',
                !exists && 'opacity-40'
              )}
              onClick={() => handleSelectFile(name)}
              disabled={!exists}
            >
              {name}
            </Button>
          )
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            {t('projectArchive.loading', { defaultValue: 'Loading...' })}
          </div>
        ) : fileContent !== null ? (
          <pre className="whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 p-4 font-mono text-xs leading-5">
            {fileContent}
          </pre>
        ) : (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            {t('projectArchive.persona.selectFile', {
              defaultValue: 'Select a persona file to preview'
            })}
          </div>
        )}
      </div>
    </div>
  )
}
