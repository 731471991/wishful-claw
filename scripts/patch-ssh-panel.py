"""Patch SshPanel.tsx: add test-in-dialog support"""
import pathlib

p = pathlib.Path(r"D:\claw\wishful-claw\src\renderer\src\components\settings\SshPanel.tsx")
text = p.read_text(encoding="utf-8-sig")

# ── Patch 1: Replace handleSave with doSave + handleSave + handleTestInDialog ──

old1 = """  const handleSave = async (): Promise<void> => {
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
  }"""

new1 = """  const doSave = async (): Promise<string | null> => {
    if (!form.name.trim() || !form.host.trim() || !form.username.trim()) return null
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
        return editingId
      } else {
        const id = await createConnection({
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
        setEditingId(id)
        return id
      }
    } catch (err) {
      console.error('[SshPanel] Save failed:', err)
      return null
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async (): Promise<void> => {
    const id = await doSave()
    if (id) setDialogOpen(false)
  }

  const handleTestInDialog = async (): Promise<{ success: boolean; error?: string }> => {
    const id = await doSave()
    if (!id) return { success: false, error: 'Failed to save connection' }
    return await testConnection(id)
  }"""

# ── Patch 2: Add onTest prop to SshConnectionDialog ──

old2 = """      <SshConnectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingId={editingId}
        form={form}
        onFormChange={setForm}
        onSave={handleSave}
        saving={saving}
      />"""

new2 = """      <SshConnectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingId={editingId}
        form={form}
        onFormChange={setForm}
        onSave={handleSave}
        onTest={handleTestInDialog}
        saving={saving}
      />"""

# Try LF first, then CRLF
for old, new in [(old1, new1), (old2, new2)]:
    if old in text:
        text = text.replace(old, new)
        print(f"OK (LF)")
    elif old.replace("\n", "\r\n") in text:
        text = text.replace(old.replace("\n", "\r\n"), new.replace("\n", "\r\n"))
        print(f"OK (CRLF)")
    else:
        print(f"NOT FOUND: {old[:60]}...")
        import sys
        sys.exit(1)

p.write_text(text, encoding="utf-8-sig")
print("File written")
