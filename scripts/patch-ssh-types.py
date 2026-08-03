"""Patch types.ts: add password/passphrase to SshConnection and SshConnectionRow"""
import pathlib

p = pathlib.Path(r"D:\claw\wishful-claw\src\renderer\src\stores\ssh\types.ts")
text = p.read_text(encoding="utf-8")

# 1. Add password/passphrase to SshConnection interface
old1 = """  hasPassword: boolean
  hasPassphrase: boolean
}"""
new1 = """  hasPassword: boolean
  hasPassphrase: boolean
  password: string | null
  passphrase: string | null
}"""

# 2. Add password/passphrase to SshConnectionRow interface
old2 = """  has_password?: boolean
  has_passphrase?: boolean
}"""
new2 = """  has_password?: boolean
  has_passphrase?: boolean
  password?: string | null
  passphrase?: string | null
}"""

# 3. Add password/passphrase to rowToConnection
old3 = """    hasPassword: row.has_password === true,
    hasPassphrase: row.has_passphrase === true
  }
}"""
new3 = """    hasPassword: row.has_password === true,
    hasPassphrase: row.has_passphrase === true,
    password: row.password ?? null,
    passphrase: row.passphrase ?? null
  }
}"""

for old, new, label in [(old1, new1, "SshConnection"), (old2, new2, "SshConnectionRow"), (old3, new3, "rowToConnection")]:
    if old in text:
        text = text.replace(old, new)
        print(f"{label}: OK (LF)")
    elif old.replace("\n", "\r\n") in text:
        text = text.replace(old.replace("\n", "\r\n"), new.replace("\n", "\r\n"))
        print(f"{label}: OK (CRLF)")
    else:
        print(f"{label}: NOT FOUND")
        import sys; sys.exit(1)

p.write_text(text, encoding="utf-8")
print("Done")
