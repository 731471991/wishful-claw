import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { buildHtmlRendererDocument, isRecord, readStringProp, readArrayProp, readString, readStringArray, safeHttpUrl, formatFieldValue, stringifyData, HTML_RENDERER_SOURCE } from './extension-tool-helpers'

function ExtensionAssetHtmlRenderer({
  extensionId,
  assetPath,
  title,
  props
}: {
  extensionId: string
  assetPath?: string
  title: string
  props: Record<string, unknown>
}): React.JSX.Element {
  const { t } = useTranslation('chat')
  const iframeRef = React.useRef<HTMLIFrameElement>(null)
  const [srcDoc, setSrcDoc] = React.useState('')
  const [height, setHeight] = React.useState(96)
  const [error, setError] = React.useState<string | null>(null)
  const loaded = useExtensionStore((state) => state.loaded)
  const loadExtensions = useExtensionStore((state) => state.loadExtensions)

  React.useEffect(() => {
    if (!loaded) void loadExtensions()
  }, [loadExtensions, loaded])

  React.useEffect(() => {
    let canceled = false
    setError(null)
    setSrcDoc('')
    setHeight(96)
    if (!loaded) return
    if (!assetPath) {
      setError(t('extensionResult.rendererMissing', { defaultValue: 'Renderer not found' }))
      return
    }
    ipcClient
      .invoke(IPC.EXTENSION_READ_ASSET, {
        id: extensionId,
        path: assetPath
      })
      .then((response) => {
        const data = response as { content?: string; error?: string }
        if (canceled) return
        if (data.error) {
          setError(data.error)
        } else {
          setSrcDoc(buildHtmlRendererDocument(data.content ?? ''))
        }
      })
      .catch((err) => {
        if (!canceled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      canceled = true
    }
  }, [assetPath, extensionId, loaded, t])

  React.useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      if (event.source !== iframeRef.current?.contentWindow) return
      const data = event.data
      if (!isRecord(data) || data.source !== HTML_RENDERER_SOURCE) return
      if (data.type === 'ready') {
        iframeRef.current?.contentWindow?.postMessage(
          {
            source: HTML_RENDERER_SOURCE,
            type: 'props',
            props
          },
          '*'
        )
      }
      if (data.type === 'resize' && typeof data.height === 'number') {
        setHeight(Math.max(80, Math.min(1200, data.height)))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [props])

  if (error) {
    return (
      <div className="rounded-md border border-destructive/20 p-3 text-xs text-destructive">
        {error}
      </div>
    )
  }
  if (!srcDoc) {
    return (
      <div className="rounded-md border border-border/60 p-3 text-xs text-muted-foreground">
        {t('extensionResult.loadingRenderer', { defaultValue: 'Loading renderer...' })}
      </div>
    )
  }
  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      className="block w-full rounded-lg border border-border/60 bg-transparent"
      style={{ height }}
      title={title || t('extensionResult.rendererTitle', { defaultValue: 'Extension renderer' })}
    />
  )
}

function ExtensionHtmlRenderer({
  result,
  ui
}: {
  result: ExtensionToolResult
  ui: Record<string, unknown>
}): React.JSX.Element {
  const rendererName = readStringProp(ui, ['renderer', 'name'])
  const extension = useExtensionStore((state) =>
    state.extensions.find((item) => item.id === result.extensionId)
  )
  const renderer = extension?.manifest.renderers?.find((item) => item.name === rendererName)

  return (
    <ExtensionAssetHtmlRenderer
      extensionId={result.extensionId}
      assetPath={renderer?.entry}
      title={rendererName}
      props={isRecord(ui.props) ? ui.props : { result, ui }}
    />
  )
}

function CardRenderer({ ui }: { ui: Record<string, unknown> }): React.JSX.Element {
  const title = typeof ui.title === 'string' ? ui.title : ''
  const subtitle = typeof ui.subtitle === 'string' ? ui.subtitle : ''
  const body = typeof ui.body === 'string' ? ui.body : ''
  const items = Array.isArray(ui.items) ? ui.items : []
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
      {title && <div className="text-sm font-semibold text-foreground">{title}</div>}
      {subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>}
      {body && <p className="mt-2 whitespace-pre-wrap text-xs text-foreground/80">{body}</p>}
      {items.length > 0 && (
        <div className="mt-2 space-y-1">
          {items.slice(0, 12).map((item, index) => (
            <div key={index} className="rounded-md bg-background/60 px-2 py-1 text-xs">
              {stringifyData(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TableRenderer({
  ui,
  fallbackData
}: {
  ui: Record<string, unknown>
  fallbackData: unknown
}): React.JSX.Element {
  const { t } = useTranslation('chat')
  const rows = Array.isArray(ui.rows)
    ? ui.rows.filter(isRecord)
    : Array.isArray(fallbackData)
      ? fallbackData.filter(isRecord)
      : []
  const configuredColumns = Array.isArray(ui.columns)
    ? ui.columns.filter((item): item is string => typeof item === 'string')
    : []
  const columns =
    configuredColumns.length > 0
      ? configuredColumns
      : Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 8)

  if (rows.length === 0 || columns.length === 0) {
    return (
      <CardRenderer
        ui={{
          title: t('extensionResult.tableTitle', { defaultValue: 'Table' }),
          body: t('extensionResult.emptyTable', { defaultValue: 'No rows to display' })
        }}
      />
    )
  }

  return (
    <div className="overflow-auto rounded-lg border border-border/60">
      <table className="w-full min-w-[420px] border-collapse text-xs">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="border-b border-border/60 px-2 py-1.5 text-left font-medium"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 30).map((row, rowIndex) => (
            <tr key={rowIndex} className="odd:bg-muted/10">
              {columns.map((column) => (
                <td key={column} className="border-b border-border/40 px-2 py-1.5 align-top">
                  {stringifyData(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FormRenderer({ ui }: { ui: Record<string, unknown> }): React.JSX.Element {
  const fields = Array.isArray(ui.fields) ? ui.fields.filter(isRecord) : []
  return (
    <div className="grid gap-2 rounded-lg border border-border/60 bg-muted/10 p-3">
      {fields.slice(0, 12).map((field, index) => {
        const label = String(field.label ?? field.name ?? `field_${index + 1}`)
        const value = String(field.value ?? '')
        return (
          <label key={index} className="grid gap-1 text-xs">
            <span className="text-muted-foreground">{label}</span>
            <input
              value={value}
              readOnly
              className="rounded-md border border-border/60 bg-background px-2 py-1.5 text-foreground"
            />
          </label>
        )
      })}
    </div>
  )
}

function ChartRenderer({ ui }: { ui: Record<string, unknown> }): React.JSX.Element {
  const { t } = useTranslation('chat')
  const data = Array.isArray(ui.data) ? ui.data.filter(isRecord) : []
  const values = data.map((item) => Number(item.value ?? 0)).filter(Number.isFinite)
  const max = Math.max(...values, 1)
  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-muted/10 p-3">
      {data.slice(0, 12).map((item, index) => {
        const label = String(
          item.label ??
            item.name ??
            t('extensionResult.chartItem', {
              defaultValue: 'Item {{index}}',
              index: index + 1
            })
        )
        const value = Number(item.value ?? 0)
        const width = `${Math.max(2, Math.min(100, (value / max) * 100))}%`
        return (
          <div key={index} className="grid grid-cols-[120px_1fr_auto] items-center gap-2 text-xs">
            <span className="truncate text-muted-foreground" title={label}>
              {label}
            </span>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary/70" style={{ width }} />
            </div>
            <span className="font-mono text-muted-foreground" style={{ fontFamily: MONO_FONT }}>
              {Number.isFinite(value) ? value : 0}
            </span>
          </div>
        )
      })}
    </div>
  )
}

