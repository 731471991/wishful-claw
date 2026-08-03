import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Loader2, Zap, CheckCircle2, XCircle } from 'lucide-react'
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
  onTest?: () => Promise<{ success: boolean; error?: string }>
  saving: boolean
}

export function SshConnectionDialog({
  open,
  onOpenChange,
  editingId,
  form,
  onFormChange,
  onSave,
  onTest,
  saving
}: SshConnectionDialogProps): React.JSX.Element {
  const { t } = useTranslation('settings')
  const [showPassword, setShowPassword] = React.useState(false)
  const [showPassphrase, setShowPassphrase] = React.useState(false)
  const [testing, setTesting] = React.useState(false)
  const [testResult, setTestResult] = React.useState<{ success: boolean; error?: string } | null>(null)

  // Reset test result when dialog opens or form changes
  React.useEffect(() => {
    if (open) {
      setTestResult(null)
    }
  }, [open])

  const set = <K extends keyof SshFormData>(key: K, value: SshFormData[K]): void => {
    onFormChange((prev) => ({ ...prev, [key]: value }))
    setTestResult(null)
  }

  const handleTest = async (): Promise<void> => {
    if (!onTest) return
    setTesting(true)
    setTestResult(null)
    try {
      const result = await onTest()
      setTestResult(result)
    } catch (err) {
      setTestResult({ success: false, error: err instanceof Error ? err.message : String(err) })
    } finally {
      setTesting(false)
    }
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
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder="••••••••"
                  className="pr-9"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
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
                <div className="relative">
                  <Input
                    type={showPassphrase ? 'text' : 'password'}
                    value={form.passphrase}
                    onChange={(e) => set('passphrase', e.target.value)}
                    placeholder="••••••••"
                    className="pr-9"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassphrase((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPassphrase ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
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

          {/* Test result feedback */}
          {testResult && (
            <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
              testResult.success
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600'
                : 'border-red-500/30 bg-red-500/5 text-red-600'
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="size-4 shrink-0" />
              ) : (
                <XCircle className="size-4 shrink-0" />
              )}
              <span className="min-w-0 truncate">
                {testResult.success
                  ? t('ssh.testSuccess', { defaultValue: 'Connection test successful' })
                  : testResult.error || t('ssh.testFailed', { defaultValue: 'Connection test failed' })}
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleTest()}
            disabled={testing || !form.host.trim() || !form.username.trim() || (form.authType === 'password' && !form.password && !editingId)}
            className="gap-1.5"
          >
            {testing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Zap className="size-4" />
            )}
            {t('ssh.test', { defaultValue: 'Test connection' })}
          </Button>
          <div className="flex gap-2">
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
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
