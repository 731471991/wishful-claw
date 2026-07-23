path = 'D:/claw/wishful-claw/src/renderer/src/hooks/use-chat-actions.ts'
content = open(path, 'r', encoding='utf-8').read()

old = """      // Build system prompt with context
      const settings = useSettingsStore.getState()
      const systemPrompt = buildSystemPrompt({
        workingFolder,
        projectName,
        language: settings.language,
        toolDefs: tools ?? undefined
      })

      const provider = {
        id: activeProvider.id,
        name: activeProvider.name,
        type: activeProvider.type,
        apiKey: activeProvider.apiKey,
        baseUrl: activeProvider.baseUrl,
        model: modelId,
        systemPrompt,
        temperature: settings.temperature ?? undefined,
        maxTokens: settings.maxTokens ?? undefined
      }

      await sendMessage({
        provider,
        messages: [...historyMessages, { role: 'user', content: text }],
        sessionId: targetSessionId,
        tools: tools ?? undefined,
        workingFolder,
        maxIterations: 10,
        maxParallelTools: settings.maxParallelToolCalls,
        maxToolCallsPerTurn: settings.maxToolCallsPerTurn
      })"""

new = """      // System prompt is now built by the backend PromptBuilder
      // using personaId + workingFolder + language + userRules.
      const settings = useSettingsStore.getState()

      const provider = {
        id: activeProvider.id,
        name: activeProvider.name,
        type: activeProvider.type,
        apiKey: activeProvider.apiKey,
        baseUrl: activeProvider.baseUrl,
        model: modelId,
        temperature: settings.temperature ?? undefined,
        maxTokens: settings.maxTokens ?? undefined
      }

      await sendMessage({
        provider,
        messages: [...historyMessages, { role: 'user', content: text }],
        sessionId: targetSessionId,
        tools: tools ?? undefined,
        workingFolder,
        maxIterations: 10,
        maxParallelTools: settings.maxParallelToolCalls,
        maxToolCallsPerTurn: settings.maxToolCallsPerTurn,
        personaId: settings.defaultPersonaId || undefined,
        language: settings.language,
        userRules: settings.systemPrompt || undefined
      })"""

if old in content:
    content = content.replace(old, new, 1)
    open(path, 'w', encoding='utf-8').write(content)
    print('OK - replaced')
else:
    print('NOT FOUND')
