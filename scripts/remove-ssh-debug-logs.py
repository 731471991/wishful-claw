"""Remove debug logging from SSH files"""
import pathlib

# ── repository.ts: remove debug logs ──
repo_path = pathlib.Path(r"D:\claw\wishful-claw\src\main\ssh\repository.ts")
repo = repo_path.read_text(encoding="utf-8")

# Remove the debug log line in createConnection
repo = repo.replace(
    "  encryptedPassword: input.password ? encodeSecret(input.password) : undefined,\n  console.log('[SSH DEBUG] createConnection: password provided=', !!input.password, 'encrypted=', !!encryptedPassword, 'authType=', input.authType)",
    "  encryptedPassword: input.password ? encodeSecret(input.password) : undefined"
)
repo = repo.replace(
    "  encryptedPassword: input.password ? encodeSecret(input.password) : undefined,\r\n  console.log('[SSH DEBUG] createConnection: password provided=', !!input.password, 'encrypted=', !!encryptedPassword, 'authType=', input.authType)\r\n",
    "  encryptedPassword: input.password ? encodeSecret(input.password) : undefined,\r\n"
)

# Remove debug logs in getConnectionWithSecrets
repo = repo.replace(
    """  const password = decodeSecret(cached.encryptedPassword)
  const passphrase = decodeSecret(cached.encryptedPassphrase)
  console.log('[SSH DEBUG] getConnectionWithSecrets: id=', id, 'hasEncryptedPw=', !!cached.encryptedPassword, 'decryptedPw=', !!password, 'encryptedPwPrefix=', cached.encryptedPassword?.slice(0, 20))
  return {
    ...cached.meta,
    password,
    passphrase
  }""",
    """  return {
    ...cached.meta,
    password: decodeSecret(cached.encryptedPassword),
    passphrase: decodeSecret(cached.encryptedPassphrase)
  }"""
)
# CRLF version
repo = repo.replace(
    """  const password = decodeSecret(cached.encryptedPassword)\r\n  const passphrase = decodeSecret(cached.encryptedPassphrase)\r\n  console.log('[SSH DEBUG] getConnectionWithSecrets: id=', id, 'hasEncryptedPw=', !!cached.encryptedPassword, 'decryptedPw=', !!password, 'encryptedPwPrefix=', cached.encryptedPassword?.slice(0, 20))\r\n  return {\r\n    ...cached.meta,\r\n    password,\r\n    passphrase\r\n  }""",
    """  return {\r\n    ...cached.meta,\r\n    password: decodeSecret(cached.encryptedPassword),\r\n    passphrase: decodeSecret(cached.encryptedPassphrase)\r\n  }"""
)

# Remove debug log in fromConnectionRow
repo = repo.replace(
    "function fromConnectionRow(row: SshConnectionRow): CachedConnection {\n  console.log('[SSH DEBUG] fromConnectionRow: id=', row.id, 'auth_type=', row.auth_type, 'has_encrypted_password=', !!row.encrypted_password, 'encrypted_password_preview=', row.encrypted_password?.slice(0, 20))\n  return {",
    "function fromConnectionRow(row: SshConnectionRow): CachedConnection {\n  return {"
)
repo = repo.replace(
    "function fromConnectionRow(row: SshConnectionRow): CachedConnection {\r\n  console.log('[SSH DEBUG] fromConnectionRow: id=', row.id, 'auth_type=', row.auth_type, 'has_encrypted_password=', !!row.encrypted_password, 'encrypted_password_preview=', row.encrypted_password?.slice(0, 20))\r\n  return {",
    "function fromConnectionRow(row: SshConnectionRow): CachedConnection {\r\n  return {"
)

repo_path.write_text(repo, encoding="utf-8")
print("repository.ts cleaned")

# ── auth.ts: remove debug log ──
auth_path = pathlib.Path(r"D:\claw\wishful-claw\src\main\ssh\auth.ts")
auth = auth_path.read_text(encoding="utf-8")

auth = auth.replace(
    "    config.password = connection.password\n    console.log('[SSH DEBUG] buildConnectConfig: password auth, password length=', connection.password.length, 'host=', connection.host, 'port=', connection.port, 'username=', connection.username)\n  } else if (connection.authType === 'privateKey') {",
    "    config.password = connection.password\n  } else if (connection.authType === 'privateKey') {"
)
auth = auth.replace(
    "    config.password = connection.password\r\n    console.log('[SSH DEBUG] buildConnectConfig: password auth, password length=', connection.password.length, 'host=', connection.host, 'port=', connection.port, 'username=', connection.username)\r\n  } else if (connection.authType === 'privateKey') {",
    "    config.password = connection.password\r\n  } else if (connection.authType === 'privateKey') {"
)

auth_path.write_text(auth, encoding="utf-8")
print("auth.ts cleaned")
