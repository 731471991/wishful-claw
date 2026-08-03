# v2-iter-5 探索发现报告

## 1. 后端 Provider 支持现状

### 已支持的 Provider 类型
- `openai-chat` — OpenAIChatProvider.cs (SSE 流式 + reasoning_content + tool calls)
- `anthropic` — AnthropicMessagesProvider.cs

### 未支持但预设中存在的 Provider 类型
- `openai-responses` — **后端未实现**，AgentLoop.cs 第 33 行明确拒绝
- `gemini` — 后端未实现
- `vertex-ai` — 后端未实现

### 前端能力检查
`canSidecarHandle()` (agent-bridge.ts:127) 也只返回 `openai-chat` 和 `anthropic` 为 true。

## 2. Provider 预设审计

### 22 个预设文件，26 个预设

| 预设 | builtinId | type | authMode | 模型数 | openai-responses 模型 | 状态 |
|------|-----------|------|----------|--------|----------------------|------|
| OpenAI | openai | openai-chat | apiKey | 30+ | 17 | ⚠️ 大量模型 type override |
| Anthropic | anthropic | anthropic | apiKey | 10 | 0 | ✅ 纯净 |
| DeepSeek | deepseek | anthropic | apiKey | ~4 | 0 | ✅ 纯净 |
| Google Gemini | google | openai-chat | apiKey | ~6 | 0 | ✅ 纯净 |
| OpenRouter | openrouter | openai-chat | apiKey | ~3 | 0 | ✅ 纯净 |
| Ollama | ollama | openai-chat | apiKey | ~2 | 0 | ✅ 纯净 |
| Azure OpenAI | azure-openai | openai-chat | apiKey | ~17 | 17 | ⚠️ 全部模型 openai-responses |
| Codex (OAuth) | codex-oauth | openai-responses | oauth | ~7 | 7 | ❌ 后端不支持 + OAuth |
| Copilot (OAuth) | copilot-oauth | openai-chat | oauth | ~10 | 8 | ❌ OAuth 不通 |
| xAI | x-ai | openai-responses | apiKey | ~5 | 5 | ❌ 后端不支持 |
| LongCat | longcat | openai-chat | apiKey | ~2 | 0 | ✅ 纯净 |
| Moonshot | moonshot | openai-chat | apiKey | ~3 | 0 | ✅ 纯净 |
| Qwen | qwen | openai-chat | apiKey | ~4 | 0 | ✅ 纯净 |
| Minimax | minimax | openai-chat | apiKey | ~3 | 0 | ✅ 纯净 |
| Baidu | baidu | openai-chat | apiKey | ~3 | 0 | ✅ 纯净 |
| SiliconFlow | siliconflow | openai-chat | apiKey | ~3 | 0 | ✅ 纯净 |
| Gitee AI | gitee-ai | openai-chat | apiKey | ~3 | 0 | ✅ 纯净 |
| Xiaomi | xiaomi | openai-chat | apiKey | ~3 | 0 | ✅ 纯净 |
| BigModel | bigmodel | openai-chat | apiKey | ~3 | 0 | ✅ 纯净 |
| Volcengine | volcengine | openai-chat | apiKey | ~3 | 0 | ✅ 纯净 |

## 3. 关键问题

### 问题 1：`openai-responses` 模型类型覆盖是死代码

**现象**：OpenAI 预设中 GPT-5 系列、o3、o4-mini 等模型有 `type: 'openai-responses'` 覆盖，但：
- `mapSidecarProvider()` 只传 `provider.type`，不传 `model.type`
- 后端 AgentLoop 只检查 `provider.type`，不检查 `model.type`
- 结果：GPT-5 模型实际走 `openai-chat` 协议（`/chat/completions`），Responses API 类型覆盖被忽略

**影响**：
- OpenAI 官方 API：GPT-5 系列同时支持 Chat Completions 和 Responses API，所以实际可能能跑通
- Azure OpenAI：所有模型都是 `openai-responses`，但 provider type 是 `openai-chat`，实际走 Chat Completions
- xAI：provider type 直接是 `openai-responses`，后端会直接拒绝

**结论**：model-level `type: 'openai-responses'` 覆盖在当前架构下无效。应清理为统一的 `openai-chat`，或移除覆盖。

### 问题 2：OAuth Provider 不可用

**现象**：
- `isProviderAuthReady()` (provider-store.ts:237) 只对 `authMode === 'apiKey'` 返回 true
- `authMode === 'oauth'` 永远返回 false → OAuth Provider 永远显示为"未认证"状态
- OAuth 流程文件存在（oauth.ts 519 行 + provider-auth.ts 417 行）但 auth readiness 检查阻断

**影响**：Codex OAuth 和 Copilot OAuth 两个预设不可用。

**结论**：OAuth 是 OpenCowork 遗留的复杂功能，当前不计划支持。应移除或标记为不可用。

### 问题 3：`useSystemProxy` 未在后端生效

**现象**：
- 前端 `mapSidecarProvider` 传递 `useSystemProxy` 字段
- 后端 `OpenAIChatProvider` 和 `ProviderTestService` 使用各自的 static HttpClient
- `WorkerHttpClientFactory` 有 `UseProxy = true` 但未被 Provider 使用
- Provider 不检查 `useSystemProxy` 参数

**影响**：Provider 级别的代理控制不生效。系统代理通过 `SocketsHttpHandler.UseProxy = true` 默认启用（遵循系统代理设置），但 `useSystemProxy: false` 无法禁用。

**结论**：需要让 Provider 读取 `useSystemProxy` 参数并决定是否使用代理。

### 问题 4：xAI 预设 provider type 为 `openai-responses`

**现象**：xAI 预设的 provider type 直接是 `openai-responses`，不像 OpenAI 那样是 provider-level `openai-chat` + model-level 覆盖。

**影响**：选择 xAI 预设时，`canSidecarHandle('provider.openai-responses')` 返回 false，前端会报错。

**结论**：xAI 的 provider type 应改为 `openai-chat`（Grok 模型支持 OpenAI 兼容的 `/chat/completions` 端点）。

### 问题 5：Azure OpenAI `defaultBaseUrl` 为空

**现象**：`defaultBaseUrl: ''` — 需要用户手动填写。

**结论**：这是正确的设计（每个 Azure 部署有不同端点），但 UI 应有更明确的提示。

## 4. 中转商 stream_options.include_usage 验证

`OpenAIChatRequestBuilder.cs` 第 80 行始终发送 `stream_options: { include_usage: true }`。

- OpenAI 官方 API：支持，返回 usage 统计
- DeepSeek API：支持
- 中转商：取决于实现，部分中转商可能不转发 usage 数据
- 不支持的中转商：`stream_options` 字段会被忽略，不影响正常使用，只是 token 统计为 0

**结论**：当前实现是合理的。对于不返回 usage 的中转商，前端已有 fallback 估算逻辑（`estimatedOutputTokens`）。

## 5. ProviderTestService 分析

- 连通性测试：对 `anthropic` 类型发 POST `/v1/messages`，对其他类型发 POST `/chat/completions`
- 模型列表拉取：对 `anthropic` 类型 GET `/v1/models`，对其他类型 GET `/v1/models` 或 `/models`
- 使用独立的 HttpClient（30s 超时，允许不安全 TLS）
- **不使用系统代理**（问题同问题 3）

## 6. 可清理项

| 清理项 | 原因 | 优先级 |
|--------|------|--------|
| OAuth 预设 (codex-oauth, copilot-oauth) | OAuth 不通，死代码 | 高 |
| xAI 预设 type 改为 openai-chat | 后端不支持 openai-responses | 高 |
| OpenAI/Azure 模型的 openai-responses type 覆盖 | 死代码，误导 | 中 |
| OAuth 相关前端文件 (auth/ 目录 2215 行) | 暂未使用 | 低（保留代码，不删） |
| Channel 相关文件 (channel-store.ts, channel/ 目录) | 渠道功能未接入 | 低（保留代码，不删） |
