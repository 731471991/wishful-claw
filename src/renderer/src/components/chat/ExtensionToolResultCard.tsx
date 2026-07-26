import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
import { ExtensionComponentRenderer, SchemaRenderer } from './extension-tool-components'

export function ExtensionToolResultCard({
  output
}: {
  output?: ToolResultContent
}): React.JSX.Element | null {
  const { t } = useTranslation('chat')
  const result = parseExtensionToolResult(output)
  if (!result) return null
  const dataText = stringifyData(result.data)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="flex size-6 items-center justify-center rounded-md border border-border/60 bg-muted/30">
          <Puzzle className="size-3.5" />
        </span>
        <span className="font-medium text-foreground/80">
          {t('extensionResult.title', { defaultValue: 'Extension result' })}
        </span>
        <span className="font-mono text-[11px]">{result.extensionId}</span>
      </div>
      {result.text ? (
        <div className="whitespace-pre-wrap rounded-md border border-border/60 bg-muted/15 px-3 py-2 text-xs text-foreground/80">
          {result.text}
        </div>
      ) : null}
      <SchemaRenderer result={result} />
      {dataText && !result.ui ? (
        <pre
          className="max-h-60 overflow-auto rounded-md border border-border/60 bg-muted/15 p-2 text-xs"
          style={{ fontFamily: MONO_FONT }}
        >
          {dataText}
        </pre>
      ) : null}
    </div>
  )
}
