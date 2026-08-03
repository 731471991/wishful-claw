"""Add debug logging to SSH password pipeline"""
import pathlib

# ── 1. repository.ts: log encode/decode results ──

repo_path = pathlib.Path(r"D:\claw\wishful-claw\src\main\ssh\repository.ts")
repo = repo_path.read_text(encoding="utf-8")

# Add log in createConnection after encoding
old_enc = "  encryptedPassword: input.password ? encodeSecret(input.password) : undefined,"
new_enc = """  encryptedPassword: input.password ? encodeSecret(input.password) : undefined,
  console.log('[SSH DEBUG] createConnection: password provided=', !!input.password, 'encrypted=', !!encryptedPassword, 'authType=', input.authType)"""

if old_enc in repo:
    repo = repo.replace(old_enc, new_enc)
    print("repo: encode log added (LF)")
elif old_enc.replace("\n", "\r\n") in repo:
    repo = repo.replace(old_enc.replace("\n", "\r\n"), new_enc.replace("\n", "\r\n"))
    print("repo: encode log added (CRLF)")
else:
    print("repo: encode NOT FOUND")

# Add log in getConnectionWithSecrets
old_get = """export function getConnectionWithSecrets(id: string): SshConnectionWithSecrets | undefined {
  const cached = connectionsCache.get(id)
  if (!cached) return undefined
  return {
    ...cached.meta,
    password: decodeSecret(cached.encryptedPassword),
    passphrase: decodeSecret(cached.encryptedPassphrase)
  }
}"""

new_get = """export function getConnectionWithSecrets(id: string): SshConnectionWithSecrets | undefined {
  const cached = connectionsCache.get(id)
  if (!cached) return undefined
  const password = decodeSecret(cached.encryptedPassword)
  const passphrase = decodeSecret(cached.encryptedPassphrase)
  console.log('[SSH DEBUG] getConnectionWithSecrets: id=', id, 'hasEncryptedPw=', !!cached.encryptedPassword, 'decryptedPw=', !!password, 'encryptedPwPrefix=', cached.encryptedPassword?.slice(0, 20))
  return {
    ...cached.meta,
    password,
    passphrase
  }
}"""

if old_get in repo:
    repo = repo.replace(old_get, new_get)
    print("repo: get log added (LF)")
elif old_get.replace("\n", "\r\n") in repo:
    repo = repo.replace(old_get.replace("\n", "\r\n"), new_get.replace("\n", "\r\n"))
    print("repo: get log added (CRLF)")
else:
    print("repo: get NOT FOUND")

# Add log in fromConnectionRow
old_from = """function fromConnectionRow(row: SshConnectionRow): CachedConnection {
  return {
    meta: {"""

new_from = """function fromConnectionRow(row: SshConnectionRow): CachedConnection {
  console.log('[SSH DEBUG] fromConnectionRow: id=', row.id, 'auth_type=', row.auth_type, 'has_encrypted_password=', !!row.encrypted_password, 'encrypted_password_preview=', row.encrypted_password?.slice(0, 20))
  return {
    meta: {"""

if old_from in repo:
    repo = repo.replace(old_from, new_from)
    print("repo: fromRow log added (LF)")
elif old_from.replace("\n", "\r\n") in repo:
    repo = repo.replace(old_from.replace("\n", "\r\n"), new_from.replace("\n", "\r\n"))
    print("repo: fromRow log added (CRLF)")
else:
    print("repo: fromRow NOT FOUND")

repo_path.write_text(repo, encoding="utf-8")

# ── 2. auth.ts: log buildConnectConfig ──

auth_path = pathlib.Path(r"D:\claw\wishful-claw\src\main\ssh\auth.ts")
auth = auth_path.read_text(encoding="utf-8")

old_auth = """  if (connection.authType === 'password') {
    if (!connection.password) {
      throw new Error('Password is required for password authentication')
    }
    config.password = connection.password
  } else if (connection.authType === 'privateKey') {"""

new_auth = """  if (connection.authType === 'password') {
    if (!connection.password) {
      throw new Error('Password is required for password authentication')
    }
    config.password = connection.password
    console.log('[SSH DEBUG] buildConnectConfig: password auth, password length=', connection.password.length, 'host=', connection.host, 'port=', connection.port, 'username=', connection.username)
  } else if (connection.authType === 'privateKey') {"""

if old_auth in auth:
    auth = auth.replace(old_auth, new_auth)
    print("auth: log added (LF)")
elif old_auth.replace("\n", "\r\n") in auth:
    auth = auth.replace(old_auth.replace("\n", "\r\n"), new_auth.replace("\n", "\r\n"))
    print("auth: log added (CRLF)")
else:
    print("auth: NOT FOUND")

auth_path.write_text(auth, encoding="utf-8")

print("Done")
