import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@renderer/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'

export type AuthType = 'password' | 'privateKey' | 'agent'

export interface SshFormData {
  name: string
  host: string
  port: number
  username: string
  authType: AuthType
  password: string
  privateKeyPath: string
  passphrase: string
  defaultDirectory: string
  keepAliveInterval: number
}

export const DEFAULT_FORM: SshFormData = {
  name: '',
  host: '',
  port: 22,
  username: '',
  authType: 'password',
  password: '',
  privateKeyPath: '',
  passphrase: '',
  defaultDirectory: '',
  keepAliveInterval: 60
}

interface SshConnectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingId: string | null
  form: SshFormData
  onFormChange: (updater: (prev: SshFormData) => SshFormData) => void
  onSave: () => Promise<void>
  saving: boolean
}

export function SshConnectionDialog({
  open,
  onOpenChange,
  editingId,
  form,
  onFormChange,
  onSave,
  saving
}: SshConnectionDialogProps): React.JSX.Element {
  const { t } = useTranslation('settings')

  const set = <K extends keyof SshFormData>(key: K, value: SshFormData[K]): void => {
    onFormChange((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingId
              ? t('ssh.editTitle', { defaultValue: 'Edit SSH Connection' })
              : t('ssh.createTitle', { defaultValue: 'New SSH Connection' })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t('ssh.fields.name', { defaultValue: 'Name' })}
            </label>
            <Input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="My Server"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t('ssh.fields.host', { defaultValue: 'Host' })}
              </label>
              <Input
                value={form.host}
                onChange={(e) => set('host', e.target.value)}
                placeholder="192.168.1.100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t('ssh.fields.port', { defaultValue: 'Port' })}
              </label>
              <Input
                type="number"
                value={form.port}
                onChange={(e) => set('port', parseInt(e.target.value) || 22)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t('ssh.fields.username', { defaultValue: 'Username' })}
            </label>
            <Input
              value={form.username}
              onChange={(e) => set('username', e.target.value)}
              placeholder="root"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t('ssh.fields.authType', { defaultValue: 'Authentication' })}
            </label>
            <Select
              value={form.authType}
              onValueChange={(v) => set('authType', v as AuthType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="password">
                  {t('ssh.fields.password', { defaultValue: 'Password' })}
                </SelectItem>
                <SelectItem value="privateKey">
                  {t('ssh.fields.privateKey', { defaultValue: 'Private Key' })}
                </SelectItem>
                <SelectItem value="agent">
                  {t('ssh.fields.agent', { defaultValue: 'SSH Agent' })}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.authType === 'password' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t('ssh.fields.password', { defaultValue: 'Password' })}
                {editingId && (
                  <span className="ml-1 text-muted-foreground/60">
                    ({t('ssh.fields.leaveBlank', { defaultValue: 'leave blank to keep' })})
                  </span>
                )}
              </label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder="••••••••"
              />
            </div>
          )}

          {form.authType === 'privateKey' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {t('ssh.fields.keyPath', { defaultValue: 'Private Key Path' })}
                </label>
                <Input
                  value={form.privateKeyPath}
                  onChange={(e) => set('privateKeyPath', e.target.value)}
                  placeholder="~/.ssh/id_rsa"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {t('ssh.fields.passphrase', { defaultValue: 'Passphrase' })}
                  {editingId && (
                    <span className="ml-1 text-muted-foreground/60">
                      ({t('ssh.fields.leaveBlank', { defaultValue: 'leave blank to keep' })})
                    </span>
                  )}
                </label>
                <Input
                  type="password"
                  value={form.passphrase}
                  onChange={(e) => set('passphrase', e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t('ssh.fields.defaultDir', { defaultValue: 'Default Directory' })}
            </label>
            <Input
              value={form.defaultDirectory}
              onChange={(e) => set('defaultDirectory', e.target.value)}
              placeholder="/home/user/project"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('ssh.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            onClick={() => void onSave()}
            disabled={saving || !form.name.trim() || !form.host.trim() || !form.username.trim()}
          >
            {saving ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : null}
            {editingId
              ? t('ssh.save', { defaultValue: 'Save' })
              : t('ssh.create', { defaultValue: 'Create' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
