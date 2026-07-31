"""Patch chat-store/index.ts to use session-usage-totals helper."""
import pathlib

p = pathlib.Path(r"D:\claw\wishful-claw\src\renderer\src\stores\chat-store\index.ts")
data = p.read_bytes()

CRLF = b"\r\n"

# 1. Add imports after accumulateUsageSnapshot import
old_import = b"import { accumulateUsageSnapshot } from '@renderer/lib/agent/usage-merge'\r\n"
new_import = (
    b"import { accumulateUsageSnapshot } from '@renderer/lib/agent/usage-merge'\r\n"
    b"import { applyUsageDeltaToSession } from './session-usage-totals'\r\n"
    b"import { useProviderStore } from '@renderer/stores/provider-store'\r\n"
)
assert old_import in data, "import marker not found"
data = data.replace(old_import, new_import, 1)

# 2. In message_end handler, add session totals update after msg.usage line
old_block = (
    b"                  msg.usage = accumulateUsageSnapshot(msg.usage, event.usage)\r\n"
    b"\r\n"
    b"                  msg.timing = event.timing\r\n"
)
new_block = (
    b"                  msg.usage = accumulateUsageSnapshot(msg.usage, event.usage)\r\n"
    b"\r\n"
    b"                  msg.timing = event.timing\r\n"
    b"\r\n"
    b"                  // Incrementally update session-level usage totals\r\n"
    b"                  const _reqModel = msg.meta?.requestModel\r\n"
    b"                  const _providerId = _reqModel?.providerId ?? msg.debugInfo?.providerId ?? null\r\n"
    b"                  const _modelId = _reqModel?.modelId ?? msg.debugInfo?.model ?? null\r\n"
    b"                  const _providers = useProviderStore.getState().providers\r\n"
    b"                  const _provider = _providerId ? (_providers.find((p: any) => p.id === _providerId) ?? null) : null\r\n"
    b"                  const _modelCfg = (_provider && _modelId\r\n"
    b"                    ? (_provider.models.find((m: any) => m.id === _modelId) ?? null)\r\n"
    b"                    : null) ?? null\r\n"
    b"                  applyUsageDeltaToSession(session, event.usage, _modelCfg)\r\n"
)
assert old_block in data, "message_end block not found"
data = data.replace(old_block, new_block, 1)

p.write_bytes(data)
print("Done")
