import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { isRecord, readStringProp, readArrayProp, readString, readStringArray, safeHttpUrl, formatFieldValue, stringifyData } from './extension-tool-helpers'

function ComponentShell({
  icon,
  title,
  subtitle,
  children,
  action
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
  action?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-background">
      <div className="flex items-start justify-between gap-3 border-b border-border/50 bg-muted/20 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/70 text-muted-foreground">
            {icon}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">{title}</div>
            {subtitle ? (
              <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

function FieldGrid({ fields }: { fields: Record<string, unknown>[] }): React.JSX.Element {
  if (fields.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-muted/10 px-2.5 py-2 text-xs text-muted-foreground">
        No display fields matched this result.
      </div>
    )
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {fields.slice(0, 12).map((field, index) => {
        const label = readStringProp(field, ['label', 'name', 'key']) || `Field ${index + 1}`
        const value = formatFieldValue(field.value ?? field.text)
        if (!value) return null
        return (
          <div key={index} className="rounded-md border border-border/50 bg-muted/10 px-2.5 py-2">
            <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
            <div className="mt-0.5 break-words text-xs text-foreground">{value}</div>
          </div>
        )
      })}
    </div>
  )
}

function SectionList({
  sections
}: {
  sections: Record<string, unknown>[]
}): React.JSX.Element | null {
  if (sections.length === 0) return null

  return (
    <div className="space-y-3">
      {sections.slice(0, 6).map((section, index) => {
        const title = readStringProp(section, ['title', 'name']) || `Section ${index + 1}`
        const items = readArrayProp(section, ['items', 'rows'])
        if (items.length === 0) return null
        return (
          <div
            key={`${title}-${index}`}
            className="rounded-md border border-border/50 bg-muted/10 p-3"
          >
            <div className="text-xs font-semibold text-foreground">{title}</div>
            <div className="mt-2 space-y-2">
              {items.slice(0, 12).map((item, itemIndex) => {
                const label =
                  readStringProp(item, ['label', 'name', 'key']) || `Field ${itemIndex + 1}`
                const value = formatFieldValue(item.value ?? item.text)
                const badge = readStringProp(item, ['badge'])
                const imageUrl = safeHttpUrl(
                  readStringProp(item, [
                    'imageUrl',
                    'pictureUrl',
                    'breviaryPicUrl',
                    'bigPicUrl',
                    'picture'
                  ])
                )
                const details = readStringArray(item.details)
                if (!value && details.length === 0 && !imageUrl && !badge) return null
                return (
                  <div
                    key={itemIndex}
                    className="rounded-md border border-border/50 bg-background/70 p-2.5"
                  >
                    <div
                      className={
                        imageUrl ? 'grid gap-3 sm:grid-cols-[56px_minmax(0,1fr)]' : 'grid gap-2'
                      }
                    >
                      {imageUrl ? (
                        <div className="overflow-hidden rounded-md border border-border/50 bg-muted/10">
                          <img src={imageUrl} alt={label} className="h-14 w-14 object-cover" />
                        </div>
                      ) : null}
                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-foreground">{label}</div>
                          {badge ? <Badge variant="outline">{badge}</Badge> : null}
                        </div>
                        <div className="mt-1 break-words text-xs text-foreground">{value}</div>
                        {details.length ? (
                          <div className="mt-2 space-y-1">
                            {details.map((detail, detailIndex) => (
                              <div
                                key={detailIndex}
                                className="break-words text-[11px] text-muted-foreground"
                              >
                                {detail}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function LuckinShopListComponent({ props }: { props: Record<string, unknown> }): React.JSX.Element {
  const shops = readArrayProp(props, ['shops', 'items', 'rows'])
  const title = readStringProp(props, ['title']) || 'Luckin stores'
  const subtitle = readStringProp(props, ['subtitle'])

  return (
    <ComponentShell icon={<Store className="size-4" />} title={title} subtitle={subtitle}>
      <div className="space-y-2">
        {shops.slice(0, 8).map((shop, index) => {
          const name =
            readStringProp(shop, ['deptName', 'name', 'storeName']) || `Store ${index + 1}`
          const address = readStringProp(shop, ['address', 'deptAddress', 'storeAddress'])
          const businessTime = readStringProp(shop, ['businessTime', 'openingHours', 'hours'])
          const distance = readStringProp(shop, ['distanceText', 'distance'])
          const deptId = readStringProp(shop, ['deptId', 'id'])
          return (
            <div
              key={`${deptId || name}-${index}`}
              className="rounded-md border border-border/50 p-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{name}</div>
                  {address ? (
                    <div className="mt-1 flex gap-1.5 text-xs leading-5 text-muted-foreground">
                      <MapPin className="mt-0.5 size-3 shrink-0" />
                      <span className="break-words">{address}</span>
                    </div>
                  ) : null}
                </div>
                {deptId ? <Badge variant="outline">{deptId}</Badge> : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {businessTime ? <Badge variant="secondary">{businessTime}</Badge> : null}
                {distance ? <Badge variant="outline">{distance}</Badge> : null}
              </div>
            </div>
          )
        })}
      </div>
    </ComponentShell>
  )
}

function LuckinProductListComponent({
  props
}: {
  props: Record<string, unknown>
}): React.JSX.Element {
  const products = readArrayProp(props, ['products', 'items', 'rows'])
  const title = readStringProp(props, ['title']) || 'Luckin products'
  const subtitle = readStringProp(props, ['subtitle'])

  return (
    <ComponentShell icon={<Coffee className="size-4" />} title={title} subtitle={subtitle}>
      <div className="grid gap-2 sm:grid-cols-2">
        {products.slice(0, 10).map((product, index) => {
          const name =
            readStringProp(product, ['productName', 'name', 'title']) || `Product ${index + 1}`
          const sku = readStringProp(product, ['attributeSummary', 'skuName', 'skuCode', 'spec'])
          const productId = readStringProp(product, ['productId', 'id'])
          const price = readStringProp(product, [
            'badgeText',
            'estimatePrice',
            'discountPrice',
            'price',
            'initialPriceText'
          ])
          const imageUrl = safeHttpUrl(
            readStringProp(product, [
              'imageUrl',
              'pictureUrl',
              'breviaryPicUrl',
              'bigPicUrl',
              'picture'
            ])
          )
          const tags = readStringProp(product, ['tagsText'])
          const initialPrice = readStringProp(product, ['initialPriceText'])
          const details = readStringArray(product.details)
          return (
            <div
              key={`${productId || name}-${index}`}
              className="rounded-md border border-border/50 p-2.5"
            >
              <div
                className={imageUrl ? 'grid gap-3 sm:grid-cols-[64px_minmax(0,1fr)]' : 'grid gap-2'}
              >
                {imageUrl ? (
                  <div className="overflow-hidden rounded-md border border-border/50 bg-muted/10">
                    <img src={imageUrl} alt={name} className="h-16 w-16 object-cover" />
                  </div>
                ) : null}
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{name}</div>
                      {sku ? (
                        <div className="mt-1 break-words text-xs text-muted-foreground">{sku}</div>
                      ) : null}
                    </div>
                    {price ? <Badge variant="secondary">{price}</Badge> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {productId ? <Badge variant="outline">productId: {productId}</Badge> : null}
                    {tags ? <Badge variant="outline">{tags}</Badge> : null}
                    {initialPrice && initialPrice !== price ? (
                      <Badge variant="outline">原价 {initialPrice}</Badge>
                    ) : null}
                  </div>
                  {details.length ? (
                    <div className="mt-2 space-y-1">
                      {details.slice(0, 4).map((detail, detailIndex) => (
                        <div
                          key={detailIndex}
                          className="break-words text-[11px] text-muted-foreground"
                        >
                          {detail}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </ComponentShell>
  )
}

function LuckinSummaryComponent({
  props,
  fallbackTitle,
  icon
}: {
  props: Record<string, unknown>
  fallbackTitle: string
  icon: React.ReactNode
}): React.JSX.Element {
  const title = readStringProp(props, ['title']) || fallbackTitle
  const subtitle = readStringProp(props, ['subtitle'])
  const fields = readArrayProp(props, ['fields', 'items'])
  const sections = readArrayProp(props, ['sections'])
  return (
    <ComponentShell icon={icon} title={title} subtitle={subtitle}>
      <div className="space-y-3">
        <FieldGrid fields={fields} />
        <SectionList sections={sections} />
      </div>
    </ComponentShell>
  )
}

function LuckinPaymentComponent({ props }: { props: Record<string, unknown> }): React.JSX.Element {
  const qrCodeUrl = safeHttpUrl(readStringProp(props, ['qrCodeUrl', 'payOrderQrCodeUrl']))
  const openUrl = safeHttpUrl(readStringProp(props, ['openUrl'])) || qrCodeUrl
  const title = readStringProp(props, ['title']) || 'Luckin payment'
  const subtitle = readStringProp(props, ['subtitle'])
  const fields = readArrayProp(props, ['fields', 'items'])

  return (
    <ComponentShell
      icon={<CreditCard className="size-4" />}
      title={title}
      subtitle={subtitle}
      action={
        openUrl ? (
          <Button asChild size="xs" variant="outline">
            <a href={openUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3" />
              Open
            </a>
          </Button>
        ) : null
      }
    >
      <div className="grid gap-3 md:grid-cols-[160px_1fr]">
        {qrCodeUrl ? (
          <div className="flex items-center justify-center rounded-md border border-border/50 bg-white p-2">
            <img src={qrCodeUrl} alt="Payment QR code" className="size-36 object-contain" />
          </div>
        ) : null}
        <div className="min-w-0 space-y-3">
          <FieldGrid fields={fields} />
          {openUrl ? (
            <a
              href={openUrl}
              target="_blank"
              rel="noreferrer"
              className="block break-all rounded-md border border-border/50 bg-muted/10 px-2.5 py-2 text-xs text-primary"
            >
              {openUrl}
            </a>
          ) : null}
        </div>
      </div>
    </ComponentShell>
  )
}

function ExtensionComponentRenderer({
  result,
  ui
}: {
  result: ExtensionToolResult
  ui: Record<string, unknown>
}): React.JSX.Element | null {
  const props = isRecord(ui.props) ? ui.props : ui
  const component = readStringProp(ui, ['component', 'name', 'renderer'])
  const extension = useExtensionStore((state) =>
    state.extensions.find((item) => item.id === result.extensionId)
  )
  const customComponent = extension?.manifest.components?.find((item) => item.name === component)

  if (customComponent) {
    return (
      <ExtensionAssetHtmlRenderer
        extensionId={result.extensionId}
        assetPath={customComponent.entry}
        title={customComponent.title ?? customComponent.name}
        props={props}
      />
    )
  }

  if (component === 'luckin_shop_list') return <LuckinShopListComponent props={props} />
  if (component === 'luckin_product_list') return <LuckinProductListComponent props={props} />
  if (component === 'luckin_payment') return <LuckinPaymentComponent props={props} />
  if (component === 'luckin_order_summary') {
    return (
      <LuckinSummaryComponent
        props={props}
        fallbackTitle="Luckin order"
        icon={<ReceiptText className="size-4" />}
      />
    )
  }
  if (component === 'luckin_status') {
    return (
      <LuckinSummaryComponent
        props={props}
        fallbackTitle="Luckin status"
        icon={<PackageSearch className="size-4" />}
      />
    )
  }

  return (
    <CardRenderer
      ui={{
        title: component || 'Extension component',
        subtitle: result.extensionId,
        body: stringifyData(props)
      }}
    />
  )
}

function SchemaRenderer({ result }: { result: ExtensionToolResult }): React.JSX.Element | null {
  const ui = isRecord(result.ui) ? result.ui : null
  if (!ui) return null
  const kind = ui.kind
  if (kind === 'card') return <CardRenderer ui={ui} />
  if (kind === 'table') return <TableRenderer ui={ui} fallbackData={result.data} />
  if (kind === 'form') return <FormRenderer ui={ui} />
  if (kind === 'chart') return <ChartRenderer ui={ui} />
  if (kind === 'html') return <ExtensionHtmlRenderer result={result} ui={ui} />
  if (kind === 'component') return <ExtensionComponentRenderer result={result} ui={ui} />
  return null
}

