import * as React from 'react'
import { FileCode2, Puzzle } from 'lucide-react'
import { Badge } from '@renderer/components/ui/badge'
import { cn } from '@renderer/lib/utils'
import { parseSelectFileText } from '@renderer/lib/select-file-tags'

interface SelectFileInlineTextProps {
  text: string
  className?: string
  overlay?: boolean
}

export function SelectFileInlineText({
  text,
  className,
  overlay = false
}: SelectFileInlineTextProps): React.JSX.Element {
  const segments = React.useMemo(() => parseSelectFileText(text), [text])

  return (
    <span className={cn('whitespace-pre-wrap break-words', className)}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <React.Fragment key={`${segment.raw}-${index}`}>{segment.text}</React.Fragment>
        }
        const isPlugin = segment.type === 'plugin'
        const Icon = isPlugin ? Puzzle : FileCode2
        const badgeClassName = isPlugin
          ? 'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300'
          : 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300'

        if (overlay) {
          return (
            <span key={`${segment.raw}-${index}`} className="relative inline-block align-baseline">
              <span className="invisible">{isPlugin ? segment.text : segment.raw}</span>
              <Badge
                variant="secondary"
                className={cn(
                  'absolute inset-0 inline-flex max-w-full items-center justify-start gap-1 overflow-hidden rounded-md border px-2 py-0 text-[12px] font-medium',
                  badgeClassName
                )}
              >
                <Icon className="size-3 shrink-0" />
                <span className="truncate">{segment.text}</span>
              </Badge>
            </span>
          )
        }

        return (
          <Badge
            key={`${segment.raw}-${index}`}
            variant="secondary"
            className={cn(
              'mx-0.5 inline-flex max-w-full items-center gap-1 overflow-hidden rounded-md border align-baseline text-[12px] font-medium',
              badgeClassName
            )}
          >
            <Icon className="size-3 shrink-0" />
            <span className="truncate">{segment.text}</span>
          </Badge>
        )
      })}
    </span>
  )
}
