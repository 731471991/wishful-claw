"""Patch session-slice.ts to initialize usageTotals after loading messages."""
import pathlib

p = pathlib.Path(r"D:\claw\wishful-claw\src\renderer\src\stores\chat-store\session-slice.ts")
data = p.read_bytes()

# 1. Add import for initSessionUsageTotals
old_import = b"import { dbCreateSession, dbDeleteSession, dbUpdateSession, dbListMessagesPage, dbGetMessageCount } from './db-helpers'\r\n"
new_import = (
    b"import { dbUpsertMessage, dbUpdateSession, awaitSessionCreated } from './db-helpers'\r\n"
    b"import { initSessionUsageTotals } from './session-usage-totals'\r\n"
    b"import { useProviderStore } from '@renderer/stores/provider-store'\r\n"
)
assert old_import in data, "import marker not found"
data = data.replace(old_import, new_import, 1)

# 2. After target.lastKnownMessageCount = actualCount, add initSessionUsageTotals call
old_block = b"        target.lastKnownMessageCount = actualCount\r\n      })\r\n"
new_block = (
    b"        target.lastKnownMessageCount = actualCount\r\n"
    b"        // Initialize cached usage totals from loaded messages\r\n"
    b"        initSessionUsageTotals(target, useProviderStore.getState().providers as any)\r\n"
    b"      })\r\n"
)
assert old_block in data, "loadRecentSessionMessages block not found"
data = data.replace(old_block, new_block, 1)

p.write_bytes(data)
print("Done")
