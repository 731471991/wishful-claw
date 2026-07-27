import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Plus, Pencil, Server, Trash2, Zap, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useSshStore, type SshConnection } from '@renderer/stores/ssh-store'
import {
  SshConnectionDialog,
  DEFAULT_FORM,
  type SshFormData
} from './SshConnectionDialog'

export function SshPanel(): React.JSX.Element {
  const { t } = useTranslation('settings')
  const connections = useSshStore((s) => s.connections)
  const loaded = useSshStore((s) => s._loaded)
  const loadAll = useSshStore((s) => s.loadAll)
  const createConnection = useSshStore((s) => s.createConnection)
  const updateConnection = useSshStore((s) => s.updateConnection)
  const deleteConnection = useSshStore((s) => s.deleteConnection)
  const testConnection = useSshStore((s) => s.testConnection)

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<SshFormData>(DEFAULT_FORM)
  const [saving, setSaving] = React.useState(false)
  const [testingId, setTestingId] = React.useState<string | null>(null)
  const [testResults, setTestResults] = React.useState<Record<string, { success: boolean; error?: string }>>({})

  React.useEffect(() => {
    void loadAll()
  }, [loadAll])

  const openCreate = (): void => {
    setForm(DEFAULT_FORM)
    setEditingId(null)
    setDialogOpen(true)
  }

  const openEdit = (conn: SshConnection): void => {
    setForm({
      name: conn.name,
      host: conn.host,
      port: conn.port,
      username: conn.username,
      authType: conn.authType,
      password: '',
      privateKeyPath: conn.privateKeyPath ?? '',
      passphrase: '',
      defaultDirectory: conn.defaultDirectory ?? '',
      keepAliveInterval: conn.keepAliveInterval
    })
    setEditingId(conn.id)
    setDialogOpen(true)
  }

  const handleSave = async (): Promise<void> => {
    if (!form.name.trim() || !form.host.trim() || !form.username.trim()) return
    setSaving(true)
    try {
      if (editingId) {
        await updateConnection(editingId, {
          name: form.name.trim(),
          host: form.host.trim(),
          port: form.port,
          username: form.username.trim(),
          authType: form.authType,
          password: form.password || null,
          privateKeyPath: form.privateKeyPath || null,
          passphrase: form.passphrase || null,
          defaultDirectory: form.defaultDirectory || null,
          keepAliveInterval: form.keepAliveInterval
        })
      } else {
        await createConnection({
          name: form.name.trim(),
          host: form.host.trim(),
          port: form.port,
          username: form.username.trim(),
          authType: form.authType,
          password: form.password || undefined,
          privateKeyPath: form.privateKeyPath || undefined,
          passphrase: form.passphrase || undefined,
          defaultDirectory: form.defaultDirectory || undefined,
          keepAliveInterval: form.keepAliveInterval
        })
      }
      setDialogOpen(false)
    } catch (err) {
      console.error('[SshPanel] Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string): Promise<void> => {
    await deleteConnection(id)
    setTestResults((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const handleTest = async (id: string): Promise<void> => {
    setTestingId(id)
    try {
      const result = await testConnection(id)
      setTestResults((prev) => ({ ...prev, [id]: result }))
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: false, error: err instanceof Error ? err.message : String(err) }
      }))
    } finally {
      setTestingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-8 pb-16 pt-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {t('ssh.title', { defaultValue: 'SSH Connections' })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('ssh.description', {
              defaultValue: 'Manage SSH server connections for remote command execution.'
            })}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="size-4" />
          {t('ssh.add', { defaultValue: 'Add Connection' })}
        </Button>
      </div>

      {!loaded ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : connections.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16">
          <Server className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {t('ssh.empty', { defaultValue: 'No SSH connections yet. Click "Add Connection" to create one.' })}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map((conn) => {
            const testResult = testResults[conn.id]
            const isTesting = testingId === conn.id
            return (
              <div
                key={conn.id}
                className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <Server className="size-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{conn.name}</span>
                    {testResult && (
                      <span className="flex items-center gap-0.5 text-xs">
                        {testResult.success ? (
                          <CheckCircle2 className="size-3.5 text-emerald-500" />
                        ) : (
                          <XCircle className="size-3.5 text-red-500" />
                        )}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {conn.username}@{conn.host}:{conn.port}
                    {conn.defaultDirectory ? ` · ${conn.defaultDirectory}` : ''}
                  </div>
                  {testResult && !testResult.success && testResult.error && (
                    <div className="mt-0.5 truncate text-xs text-red-500">{testResult.error}</div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => void handleTest(conn.id)}
                    disabled={isTesting}
                    title={t('ssh.test', { defaultValue: 'Test connection' })}
                  >
                    {isTesting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Zap className="size-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => openEdit(conn)}
                    title={t('ssh.edit', { defaultValue: 'Edit' })}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-red-500"
                    onClick={() => void handleDelete(conn.id)}
                    title={t('ssh.delete', { defaultValue: 'Delete' })}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <SshConnectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingId={editingId}
        form={form}
        onFormChange={setForm}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  )
}
