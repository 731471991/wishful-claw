import {
  ShieldAlert, ShieldCheck, Check
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useTranslation } from 'react-i18next'
import { cn } from '@renderer/lib/utils'
import type { PermissionMode } from './use-permission-mode'

interface PermissionControlProps {
  permissionMode: PermissionMode
  onSelectMode: (mode: PermissionMode) => Promise<void>
  /** Retained for API compatibility; whitelist settings entry was removed. */
  onOpenSettings?: (tab?: string) => void
}

// Composer-level control: icon-only trigger (mode labels live in the dropdown
// items only, per product decision). Two tiers: default + YOLO (fullAccess).
export function PermissionControl({
  permissionMode,
  onSelectMode
}: PermissionControlProps) {
  const { t } = useTranslation('chat')
  const composerIconControlClass = 'composer-control rounded-xl'

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                composerIconControlClass,
                'px-2 text-xs font-medium',
                permissionMode === 'fullAccess' && 'text-amber-600 dark:text-amber-400'
              )}
              aria-label={t('permission.label')}
            >
              {permissionMode === 'fullAccess' ? (
                <ShieldAlert className="size-3.5" />
              ) : (
                <ShieldCheck className="size-3.5" />
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {permissionMode === 'fullAccess'
            ? t('permission.fullAccess')
            : t('permission.default')}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuItem
          className="flex-col items-start gap-0.5"
          onSelect={() => void onSelectMode('default')}
        >
          <div className="flex w-full items-center gap-2">
            <ShieldCheck className="size-3.5" />
            <span className="flex-1 font-medium">{t('permission.default')}</span>
            {permissionMode === 'default' && <Check className="size-3.5" />}
          </div>
          <span className="pl-[1.375rem] text-xs text-muted-foreground">
            {t('permission.defaultDesc')}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex-col items-start gap-0.5"
          onSelect={() => void onSelectMode('fullAccess')}
        >
          <div className="flex w-full items-center gap-2">
            <ShieldAlert className="size-3.5 text-amber-600 dark:text-amber-400" />
            <span className="flex-1 font-medium">{t('permission.fullAccess')}</span>
            {permissionMode === 'fullAccess' && <Check className="size-3.5" />}
          </div>
          <span className="pl-[1.375rem] text-xs text-muted-foreground">
            {t('permission.fullAccessDesc')}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
