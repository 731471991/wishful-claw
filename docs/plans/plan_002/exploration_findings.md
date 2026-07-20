# 探索发现：迭代二 — AI 服务商 + 模型管理

> 探索时间：2026-07-20
> 探索对象：OpenCowork Provider 配置框架（前端 + 后端）

---

## 1. OpenCowork Provider 架构总览

OpenCowork 的 Provider 管理分三层：

| 层 | 位置 | 职责 |
|----|------|------|
| **前端 Store** | `src/renderer/src/stores/provider-store.ts` (2293行) | Zustand store，管理 Provider 列表、模型列表、默认模型，通过 persist 中间件持久化 |
| **Main 进程 IPC** | `src/main/ipc/ai-provider-handlers.ts` (39行) + `src/main/lib/ai-provider-store.ts` (329行) | IPC 桥接 + 文件存储（`~/.open-cowork/ai-provider/` 目录，index.json + per-provider JSON 文件） |
| **Worker 后端** | `sidecars/.../Modules/Config/ConfigStore.cs` (216行) | 通用 JSON 配置存储（`~/.open-cowork/config.json`），Worker 端 CRUD |

### 数据流

```
Renderer (Zustand store)
  → persist middleware → aiProviderStorage (IPC state storage)
  → ipcRenderer.invoke('ai-provider:set', { key, value })
  
Main Process
  → ipcMain.handle('ai-provider:set')
  → writePersistedProviderStore(value)
  → 写入 ~/.open-cowork/ai-provider/index.json + provider-*.json

连通性测试：
Renderer → ipcClient.invoke('api:request', { url, method, headers, body })
Main → api-proxy.ts → Electron net.request() → HTTP 请求 → 返回 statusCode + body
```

## 2. 关键文件清单

### 后端 (.NET)

| 文件 | 行数 | 用途 | 搬入策略 |
|------|------|------|---------|
| `Modules/Config/ConfigStore.cs` | 216 | 通用 JSON 配置 CRUD | 搬入，改命名空间和路径 |
| `Modules/Config/ConfigModule.cs` | 13 | Config 模块注册 | 搬入 |
| `Modules/Settings/SettingsStore.cs` | 214 | 设置存储 | 搬入（合并到 ConfigStore） |
| `Modules/AgentRuntime/AgentRuntimeProviderSupport.cs` | 268 | HTTP header/body 覆盖 | 迭代三再搬（Provider 运行时） |
| `Modules/AgentRuntime/AgentRuntimeModels.cs` | 156 | Agent 运行时数据模型 | 迭代三再搬 |
| `Modules/AgentRuntime/AgentRuntimeProviderModels.cs` | 33 | Provider 转换模型 | 迭代三再搬 |

### 前端 (TS/React)

| 文件 | 行数 | 用途 | 搬入策略 |
|------|------|------|---------|
| `lib/api/types.ts` | 770+ | 核心类型定义（AIProvider, AIModelConfig, ProviderConfig 等） | 搬入，裁剪不需要的字段 |
| `stores/providers/types.ts` | 47 | BuiltinProviderPreset 接口 | 直接搬入 |
| `stores/providers/index.ts` | 133 | 内置 Provider 预设列表 | 搬入，删除 routin-ai |
| `stores/providers/openai.ts` | 650 | OpenAI 预设 | 搬入 |
| `stores/providers/anthropic.ts` | ~300 | Anthropic 预设 | 搬入 |
| `stores/providers/deepseek.ts` | ~100 | DeepSeek 预设 | 搬入 |
| `stores/providers/openrouter.ts` | ~100 | OpenRouter 预设 | 搬入 |
| `stores/providers/ollama.ts` | ~50 | Ollama 预设 | 搬入 |
| `stores/providers/routin-ai.ts` | 1787 | routin-ai 预设 | **删除，不搬入** |
| `stores/provider-store.ts` | 2293 | Zustand store | 搬入，大量裁剪 |
| `lib/ipc/ai-provider-storage.ts` | 10 | IPC 持久化适配器 | 搬入 |
| `components/settings/ProviderPanel.tsx` | 4751 | Provider 设置页面 | 搬入，大量裁剪 |
| `main/ipc/ai-provider-handlers.ts` | 39 | Main 进程 IPC 处理 | 搬入 |
| `main/lib/ai-provider-store.ts` | 329 | 文件存储 | 搬入，改路径 |
| `main/ipc/api-proxy.ts` | 461 | HTTP API 代理（连通性测试用） | 搬入，简化 |

## 3. Provider 配置数据结构

### AIProvider（一个 Provider 的完整配置）

```typescript
interface AIProvider {
  id: string              // UUID
  name: string            // 显示名
  type: ProviderType      // 'anthropic' | 'openai-chat' | 'openai-responses' | 'gemini' | 'vertex-ai'
  apiKey: string          // API Key
  baseUrl: string         // API Base URL
  enabled: boolean        // 是否启用
  models: AIModelConfig[] // 模型列表
  builtinId?: string      // 内置预设 ID
  defaultModel?: string   // 默认模型
  createdAt: number       // 创建时间
  // ... 其他字段（OAuth、channel、requestOverrides 等）
}
```

### AIModelConfig（单个模型配置）

```typescript
interface AIModelConfig {
  id: string              // 模型 ID（如 'gpt-4o'）
  name: string            // 显示名
  enabled: boolean        // 是否启用
  contextLength?: number  // 上下文长度
  maxOutputTokens?: number
  supportsVision?: boolean
  supportsFunctionCall?: boolean
  supportsThinking?: boolean
  // ... 其他字段
}
```

### BuiltinProviderPreset（内置预设）

```typescript
interface BuiltinProviderPreset {
  builtinId: string
  version: number
  name: string
  type: ProviderType
  defaultBaseUrl: string
  defaultModels: AIModelConfig[]
  homepage: string
  apiKeyUrl?: string
  defaultModel?: string
  requiresApiKey?: boolean
}
```

## 4. 存储方案

OpenCowork 的 Provider 配置存储为 JSON 文件：
- `~/.open-cowork/ai-provider/index.json` — 索引文件（providerIds + state）
- `~/.open-cowork/ai-provider/provider-{id}.json` — 单个 Provider 配置

**Wishful Claw 采用相同方案**：
- `~/.wishful-claw/ai-provider/index.json`
- `~/.wishful-claw/ai-provider/provider-{id}.json`

迭代计划提到 SQLite，但 data-storage.md 明确 SQLite 用于会话/消息/FTS 索引，Provider 配置不在其中。JSON 文件方案更简单、人可读、Git 友好，与 OpenCowork 一致。后续如需要可迁移。

## 5. 连通性测试机制

OpenCowork 的连通性测试在前端 ProviderPanel 中实现：
1. 构造一个最小请求（`max_tokens: 1, messages: [{ role: 'user', content: 'Hi' }]`）
2. 通过 `api:request` IPC 发送到 Main 进程
3. Main 进程的 `api-proxy.ts` 用 Electron `net.request()` 发送 HTTP 请求
4. 返回 `{ statusCode, body, error }`
5. 前端根据 statusCode 判断：2xx = 成功，401/403 = API Key 无效，其他 = 异常

模型列表获取类似：GET `{baseUrl}/models`（OpenAI 兼容）或 `{baseUrl}/v1/models`（Anthropic）

## 6. routin.ai 清理清单

需要删除/清理的 routin.ai 相关内容：

| 位置 | 内容 | 处理 |
|------|------|------|
| `stores/providers/routin-ai.ts` | routin-ai 预设（1787行） | 不搬入 |
| `stores/providers/index.ts` | `routinAiPreset, routinAiPlanPreset` 导入和注册 | 删除 |
| `stores/provider-store.ts` | `DEFAULT_FAST_PROVIDER_BUILTIN_ID = 'routin-ai'` | 改为 `'openai'` |
| `stores/provider-store.ts` | `DEFAULT_FAST_MODEL_ID = 'doubao-seed-2-0-mini-260215'` | 改为 `'gpt-4o-mini'` |
| 其他文件 | `routin-ai` 引用 | 搜索清理 |

## 7. 潜在风险

1. **ProviderPanel.tsx 过大**（4751行）：依赖大量 UI 组件（shadcn/ui、toast、i18n、OAuth 流程等），需要大幅裁剪
2. **provider-store.ts 过大**（2293行）：包含 OAuth、channel、Copilot 等复杂逻辑，迭代二只需要 API Key 模式
3. **api-proxy.ts 复杂度**：包含重试、代理、流式等，迭代二只需要简单 HTTP 请求
4. **前端依赖链**：OpenCowork 使用 zustand、nanoid、shadcn/ui、i18n 等，需要安装和配置
5. **类型定义庞大**：types.ts 770+ 行包含大量迭代二不需要的字段（OAuth、channel、image generation 等）

## 8. 建议的裁剪策略

迭代二只需要 **API Key 模式** 的 Provider 管理，裁剪掉：
- OAuth 流程（codex-oauth、copilot-oauth）
- Channel 认证
- 图像/视频生成
- WebSocket 传输
- 上下文压缩配置
- Computer Use
- 内置 web search

保留核心：
- Provider CRUD（添加、编辑、删除、启用/禁用）
- 模型列表管理（手动添加 + 从 API 拉取）
- 连通性测试
- 内置预设（OpenAI、Anthropic、DeepSeek、OpenRouter、Ollama 等常见 Provider）
