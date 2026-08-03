# Plan: v2-iter-5 渠道配置测试与完善

## 目标

OpenAI 兼容 + Anthropic 全链路验证通过，清理不兼容或过时的预设，修复测试中发现的问题。

## 步骤清单

- [ ] 步骤1：清理 `openai-responses` 预设 — xAI provider type 改为 `openai-chat`；移除 OpenAI/Azure 模型的 `type: 'openai-responses'` 覆盖（改为继承 provider type）
  - 验证：tsc --noEmit + dotnet build 零错误

- [ ] 步骤2：移除 OAuth 预设 — 从 `builtinProviderPresets` 数组中移除 `codexOAuthPreset` 和 `copilotOAuthPreset`；移除其 import。OAuth 相关代码文件保留不删（后续迭代可能启用）
  - 验证：tsc --noEmit 零错误，应用启动后 Provider 列表不再出现 OAuth 预设

- [ ] 步骤3：修复 `useSystemProxy` 后端支持 — Provider 读取 `useSystemProxy` 参数，为 false 时禁用代理；ProviderTestService 同步修复
  - 验证：dotnet build 零错误

- [ ] 步骤4：ProviderTestService 改用 WorkerHttpClientFactory — 统一 HTTP 客户端创建，支持 `useSystemProxy` 和 `allowInsecureTls`
  - 验证：dotnet build 零错误

- [ ] 步骤5：OpenAIChatProvider 支持动态代理 — 读取 `useSystemProxy` 和 `allowInsecureTls` 参数，按需创建 HttpClient
  - 验证：dotnet build 零错误

- [ ] 步骤6：AnthropicMessagesProvider 同步修复 — 支持 `useSystemProxy` 和 `allowInsecureTls`
  - 验证：dotnet build 零错误

- [ ] 步骤7：前端 isProviderAuthReady 修复 — `authMode === 'oauth'` 时检查 `oauthAccounts` 是否有有效 token，而非一律返回 false
  - 验证：tsc --noEmit 零错误

- [ ] 步骤8：Azure OpenAI 预设优化 — defaultBaseUrl 添加提示文案或 placeholder
  - 验证：tsc --noEmit 零错误

- [ ] 步骤9：全链路验证 — OpenAI 兼容渠道（API Key → 连通性测试 → 模型列表 → 实际对话）+ Anthropic 渠道同链路
  - 验证：双编译通过，手动测试由用户确认

## 涉及文件

### 前端
- `src/renderer/src/stores/providers/index.ts` — 移除 OAuth 预设 import 和注册
- `src/renderer/src/stores/providers/x-ai.ts` — provider type 改为 openai-chat
- `src/renderer/src/stores/providers/openai.ts` — 移除模型 type: 'openai-responses' 覆盖
- `src/renderer/src/stores/providers/azure-openai.ts` — 移除模型 type 覆盖 + defaultBaseUrl 优化
- `src/renderer/src/stores/providers/copilot-oauth.ts` — 从 index 移除（文件保留）
- `src/renderer/src/stores/providers/codex-oauth.ts` — 从 index 移除（文件保留）
- `src/renderer/src/stores/provider-store.ts` — isProviderAuthReady 修复

### 后端
- `src/runtime/WishfulClaw.Agent/OpenAIChatProvider.cs` — 支持 useSystemProxy / allowInsecureTls
- `src/runtime/WishfulClaw.Agent/AnthropicMessagesProvider.cs` — 同步修复
- `src/runtime/WishfulClaw.Agent/ProviderTestService.cs` — 改用动态 HttpClient 创建

## 参考源码
- 无需参考外部项目，所有修复基于现有代码
