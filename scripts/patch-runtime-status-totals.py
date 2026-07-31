"""Patch runtime-status.tsx to use session.usageTotals instead of per-render traversal."""
import pathlib

p = pathlib.Path(r"D:\claw\wishful-claw\src\renderer\src\components\chat\InputArea\runtime-status.tsx")
data = p.read_bytes()

# Replace the traversal block with session.usageTotals lookup
old_block = (
    b"      const totals = createEmptyRuntimeUsageTotals()\r\n"
    b"      const message = streamingMessageId\r\n"
    b"        ? messages?.find((item) => item.id === streamingMessageId)\r\n"
    b"        : undefined\r\n"
    b"      if (messages) {\r\n"
    b"        const { providers } = useProviderStore.getState()\r\n"
    b"        for (const item of messages) {\r\n"
    b"          const reqModel = item.meta?.requestModel\r\n"
    b"          const providerId = reqModel?.providerId ?? item.debugInfo?.providerId ?? null\r\n"
    b"          const modelId = reqModel?.modelId ?? item.debugInfo?.model ?? model?.id ?? null\r\n"
    b"          const provider = providerId ? (providers.find((p: any) => p.id === providerId) ?? null) : null\r\n"
    b"          const msgModelCfg =\r\n"
    b"            (provider && modelId\r\n"
    b"              ? (provider.models.find((m: any) => m.id === modelId) ?? null)\r\n"
    b"              : null) ??\r\n"
    b"            (model && modelId === model.id ? model : null) ??\r\n"
    b"            model ??\r\n"
    b"            null\r\n"
    b"          addUsageToTotals(totals, item.usage, msgModelCfg)\r\n"
    b"        }\r\n"
    b"      }\r\n"
)

new_block = (
    b"      const session = idx !== undefined ? s.sessions[idx] : undefined\r\n"
    b"      const totals = createEmptyRuntimeUsageTotals()\r\n"
    b"      const message = streamingMessageId\r\n"
    b"        ? messages?.find((item) => item.id === streamingMessageId)\r\n"
    b"        : undefined\r\n"
    b"      // Use cached session totals when available (avoids per-render traversal).\r\n"
    b"      // Only traverse messages when an override is provided (sub-agent / preview).\r\n"
    b"      if (!messagesOverride && session?.usageTotals) {\r\n"
    b"        Object.assign(totals, session.usageTotals)\r\n"
    b"      } else if (messages) {\r\n"
    b"        const { providers } = useProviderStore.getState()\r\n"
    b"        for (const item of messages) {\r\n"
    b"          const reqModel = item.meta?.requestModel\r\n"
    b"          const providerId = reqModel?.providerId ?? item.debugInfo?.providerId ?? null\r\n"
    b"          const modelId = reqModel?.modelId ?? item.debugInfo?.model ?? model?.id ?? null\r\n"
    b"          const provider = providerId ? (providers.find((p: any) => p.id === providerId) ?? null) : null\r\n"
    b"          const msgModelCfg =\r\n"
    b"            (provider && modelId\r\n"
    b"              ? (provider.models.find((m: any) => m.id === modelId) ?? null)\r\n"
    b"              : null) ??\r\n"
    b"            (model && modelId === model.id ? model : null) ??\r\n"
    b"            model ??\r\n"
    b"            null\r\n"
    b"          addUsageToTotals(totals, item.usage, msgModelCfg)\r\n"
    b"        }\r\n"
    b"      }\r\n"
)

assert old_block in data, "traversal block not found"
data = data.replace(old_block, new_block, 1)

p.write_bytes(data)
print("Done")
