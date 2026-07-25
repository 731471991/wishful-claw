import * as React from 'react'
import type { TFunction } from 'i18next'
import { confirm } from '@renderer/components/ui/confirm-dialog'
import { useSettingsStore } from '@renderer/stores/settings-store'

interface UsePermissionModeOptions {
  autoApprove: boolean
  permissionWhitelistEnabled: boolean
  t: TFunction
}

export function usePermissionMode(opts: UsePermissionModeOptions) {
  const permissionMode: 'default' | 'whitelist' | 'fullAccess' = opts.autoApprove
    ? 'fullAccess'
    : opts.permissionWhitelistEnabled
      ? 'whitelist'
      : 'default'

  const handleSelectPermissionMode = React.useCallback(
    async (mode: 'default' | 'whitelist' | 'fullAccess'): Promise<void> => {
      if (mode === permissionMode) return
      if (mode === 'fullAccess') {
        const ok = await confirm({
          title: opts.t('permission.fullAccessConfirmTitle'),
          description: opts.t('permission.fullAccessConfirmDesc'),
          confirmLabel: opts.t('permission.fullAccess'),
          variant: 'destructive'
        })
        if (!ok) return
        useSettingsStore.getState().updateSettings({ autoApprove: true })
        return
      }
      const { permissionPolicy } = useSettingsStore.getState()
      useSettingsStore.getState().updateSettings({
        autoApprove: false,
        permissionPolicy: { ...permissionPolicy, enabled: mode === 'whitelist' }
      })
    },
    [permissionMode, opts.t]
  )

  return { permissionMode, handleSelectPermissionMode }
}
