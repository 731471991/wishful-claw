# Plan: 迭代二 — AI 服务商 + 模型管理

## 目标

能配置 Provider（API Key + Base URL），选择模型，测试连通性，为迭代三（Agent Loop + 对话）做准备。

## 验证标准

添加一个 OpenAI 兼容 Provider → 填 API Key 和 Base URL → 测试连通性通过 → 能看到可用模型列表。

## 步骤清单

- [✓] 步骤1：后端 — ConfigModule + ConfigStore（Worker 端 Provider 配置 CRUD）
  - 搬入 OpenCowork 的 ConfigStore.cs，改为 WishfulClaw 命名空间
  - 路径改为 `~/.wishful-claw/config.json`
  - 在 Worker 中注册 ConfigModule，提供 `config/get`、`config/set`、`config/read`、`config/write` 端点
  - 验证：`dotnet build` 通过，Worker 能响应 config/get

- [✓] 步骤2：后端 — ProviderModule（Provider 配置管理端点）
  - 在 Worker 中新增 ProviderModule，提供：
    - `provider/list` — 列出所有已配置 Provider
    - `provider/get` — 获取单个 Provider
    - `provider/save` — 保存（新增或更新）Provider
    - `provider/delete` — 删除 Provider
  - 存储路径：`~/.wishful-claw/ai-provider/index.json` + `provider-{id}.json`
  - 验证：`dotnet build` 通过

- [✓] 步骤3：后端 — ProviderTestModule（连通性测试 + 模型拉取端点）
  - 在 Worker 中新增 ProviderTestModule，提供：
    - `provider/test` — 测试连通性（发最小请求到 Provider API）
    - `provider/fetch-models` — 拉取可用模型列表（GET /v1/models 或 /models）
  - 用 `HttpClient` 发请求，支持 OpenAI 兼容和 Anthropic 两种协议
  - 验证：`dotnet build` 通过

- [✓] 步骤4：前端 — 类型定义 + Provider 预设
  - 创建 `src/shared/types/provider.ts` — 核心类型（AIProvider、AIModelConfig、ProviderType、BuiltinProviderPreset 等），裁剪 OAuth/channel/图像生成等
  - 创建 `src/renderer/src/stores/providers/` — 内置预设（openai、anthropic、deepseek、openrouter、ollama），不含 routin-ai
  - 验证：`npm run typecheck` 通过

- [✓] 步骤5：前端 — Main 进程 IPC + 文件存储
  - 搬入 `ai-provider-store.ts`（改路径为 `~/.wishful-claw/ai-provider/`）
  - 搬入 `ai-provider-handlers.ts`（注册 `ai-provider:get/set` IPC）
  - 搬入 `api-proxy.ts` 简化版（无重试、无流式，只做单次 HTTP 请求）
  - 验证：`npm run typecheck` + `electron-vite build` 通过

- [✓] 步骤6：前端 — Provider Store（Zustand）
  - 创建 `src/renderer/src/stores/provider-store.ts` — 精简版 Zustand store
  - 只保留 API Key 模式：Provider CRUD、模型列表管理、默认模型设置
  - 通过 IPC persist 持久化到 Main 进程文件
  - 验证：`npm run typecheck` 通过

- [✓] 步骤7：前端 — Provider 设置页面
  - 创建 `src/renderer/src/components/settings/ProviderPanel.tsx` — 精简版
  - 功能：Provider 列表、添加/编辑/删除 Provider、模型列表编辑、连通性测试、模型拉取
  - 不需要：OAuth、channel、图像生成、WebSocket、Copilot 等
  - 修改 App.tsx 加入设置页面入口
  - 验证：`npm run typecheck` + `electron-vite build` 通过

- [✓] 步骤8：集成验证
  - 启动应用 → 进入设置页面 → 添加 OpenAI 兼容 Provider → 填 API Key 和 Base URL → 点测试 → 连通性通过 → 点拉取模型 → 看到模型列表
  - 产出验证报告

## 涉及文件

### 新建（后端 .NET）
- `src/runtime/WishfulClaw.Worker/Modules/ConfigModule.cs` — Config 模块注册
- `src/runtime/WishfulClaw.Worker/Modules/ConfigStore.cs` — 通用 JSON 配置存储
- `src/runtime/WishfulClaw.Worker/Modules/ProviderModule.cs` — Provider CRUD 端点
- `src/runtime/WishfulClaw.Worker/Modules/ProviderStore.cs` — Provider 文件存储
- `src/runtime/WishfulClaw.Worker/Modules/ProviderTestModule.cs` — 连通性测试 + 模型拉取

### 新建（前端 TS/React）
- `src/shared/types/provider.ts` — Provider 核心类型定义
- `src/renderer/src/stores/providers/types.ts` — BuiltinProviderPreset 接口
- `src/renderer/src/stores/providers/index.ts` — 内置预设列表
- `src/renderer/src/stores/providers/openai.ts` — OpenAI 预设
- `src/renderer/src/stores/providers/anthropic.ts` — Anthropic 预设
- `src/renderer/src/stores/providers/deepseek.ts` — DeepSeek 预设
- `src/renderer/src/stores/providers/openrouter.ts` — OpenRouter 预设
- `src/renderer/src/stores/providers/ollama.ts` — Ollama 预设
- `src/renderer/src/stores/provider-store.ts` — Zustand store
- `src/renderer/src/lib/ipc/ai-provider-storage.ts` — IPC 持久化适配器
- `src/renderer/src/components/settings/ProviderPanel.tsx` — Provider 设置页面
- `src/main/ipc/ai-provider-handlers.ts` — Main 进程 IPC
- `src/main/lib/ai-provider-store.ts` — 文件存储
- `src/main/ipc/api-proxy.ts` — HTTP API 代理（简化版）

### 修改
- `src/runtime/WishfulClaw.Worker/WorkerHostBuilder.cs` — 注册新模块
- `src/main/index.ts` — 注册新 IPC handler
- `src/preload/index.ts` — 暴露 Provider API
- `src/renderer/src/App.tsx` — 添加设置页面入口
- `package.json` — 添加 zustand、nanoid 依赖

## 参考源码

- OpenCowork 后端：`D:\gy\OpenCowork\sidecars\OpenCowork.Native.Worker\Modules\Config\ConfigStore.cs`
- OpenCowork 前端类型：`D:\gy\OpenCowork\src\renderer\src\lib\api\types.ts`（行 405-760）
- OpenCowork 前端 Store：`D:\gy\OpenCowork\src\renderer\src\stores\provider-store.ts`
- OpenCowork 前端设置页：`D:\gy\OpenCowork\src\renderer\src\components\settings\ProviderPanel.tsx`
- OpenCowork Main IPC：`D:\gy\OpenCowork\src\main\ipc\ai-provider-handlers.ts`
- OpenCowork Main 存储：`D:\gy\OpenCowork\src\main\lib\ai-provider-store.ts`
- OpenCowork API 代理：`D:\gy\OpenCowork\src\main\ipc\api-proxy.ts`
