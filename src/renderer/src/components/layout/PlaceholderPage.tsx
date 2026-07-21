import { useTranslation } from 'react-i18next'
import { Construction } from 'lucide-react'

interface PlaceholderPageProps {
  title: string
  iterLabel?: string
  icon?: React.ComponentType<{ className?: string }>
}

/**
 * Placeholder page for features not yet implemented.
 * Shows the feature name, iteration label, and a "coming soon" message.
 */
export function PlaceholderPage({ title, iterLabel, icon: Icon }: PlaceholderPageProps): React.JSX.Element {
  const { t } = useTranslation('layout')

  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        {Icon ? (
          <Icon className="size-12 text-muted-foreground/30" />
        ) : (
          <Construction className="size-12 text-muted-foreground/30" />
        )}
        <h2 className="text-lg font-semibold text-foreground/80">{title}</h2>
        {iterLabel && (
          <span className="rounded-full bg-muted px-3 py-0.5 text-xs text-muted-foreground">
            {t('placeholder.iteration', { defaultValue: 'Planned for' })} {iterLabel}
          </span>
        )}
        <p className="max-w-sm text-sm text-muted-foreground/60">
          {t('placeholder.comingSoon', { defaultValue: 'This feature is not yet implemented. It will be available in a future iteration.' })}
        </p>
      </div>
    </div>
  )
}
