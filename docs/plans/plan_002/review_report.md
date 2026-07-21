# 迭代二审查报告

## 审查日期
2026-07-21

## 审查范围
- 后端：WishfulClaw.Worker（ConfigModule / ProviderModule / ProviderTestModule / ConfigStore / ProviderStore / ProviderTestService / WorkerModuleCatalog / WorkerHostBuilder）
- 前端：provider-store.ts / ai-provider-store.ts / ai-provider-handlers.ts / settings-handlers.ts / 28 个内置预设 / Provider 设置页面组件
- 项目引用：4 个 .csproj 的依赖方向

## 审查结果

### ✅ 通过项

#### 1. 分层约定
- Core → 依赖 Contracts ✅
- Workspace → 依赖 Contracts ✅（不依赖 Core）
- Worker → 依赖 Core + Workspace + Contracts ✅
- 无逆向依赖，分层正确

#### 2. 无硬编码密钥/路径
- grep 搜索未发现硬编码 API Key
- 存储路径统一使用 `~/.wishful-claw/`（后端 `Environment.GetFolderPath(SpecialFolder.UserProfile)`，前端 `os.homedir()`）
- 后端 ProviderStore 对 ID 做路径遍历防护（仅允许字母数字和连字符）
- 前端 ai-provider-store.ts 使用 `encodeURIComponent` 对 provider ID 做路径安全处理

#### 3. 正确适配参考源码
- 命名空间统一为 `WishfulClaw.*`
- 存储路径从 OpenCowork 原路径改为 `~/.wishful-claw/`
- 模块注册使用 `IWorkerModule` 模式，符合 AGENTS.md 约定
- 前端使用 `@renderer/` 路径别名
- 28 个预设与 OpenCowork 完整对齐，所有 `defaultEnabled: false`

#### 4. 错误处理充分
- ProviderTestService：超时(30s)、401/403 鉴权失败、HTTP 错误码、异常捕获
- ProviderStore：文件读取失败处理、路径遍历防护、原子写入（tmp + move）
- 前端 ai-provider-store.ts：原子写入（tmp + renameSync）、orphan 文件清理、JSON 解析错误处理
- 文件权限：目录 0o700，文件 0o600

#### 5. 模块注册完整
- WorkerModuleCatalog.Default 包含：SystemModule / ConfigModule / ProviderModule / ProviderTestModule
- 端点覆盖：config/* (5个) + provider/* (4个) + provider/test + provider/fetch-models

#### 6. 前端预设系统
- 28 个预设全部导入，含 OAuth/Channel 类型系统
- 所有预设 defaultEnabled: false（包括 routin-ai）
- thinkingConfig / reasoningEffortLevels 自动填充逻辑正确
- 默认推理级别 ['medium', 'high', 'xhigh']，defaultReasoningEffort 'medium'

### ⚠️ 注意项（非阻断，不阻塞验证）

1. **Class1.cs 占位文件**：Contracts / Core / Workspace 项目中各有模板残留的 `Class1.cs`，不影响功能，建议后续迭代清理。

2. **routin-ai 预设保留私货端点**：`https://api.routin.ai/v1` 作为 defaultBaseUrl 保留。但 `defaultEnabled: false`，需用户手动启用。这是明确决策（"不排除任何预设"），可接受。

3. **双路径持久化**：前端 Zustand persist → IPC → Main 进程文件存储（ai-provider-store.ts），Worker 端也有 ProviderStore.cs。两条路径操作同一目录 `~/.wishful-claw/ai-provider/`。前端是主写入方，Worker 端用于连通性测试时读取配置。不冲突，但需注意后续迭代中避免双写竞争。

### ❌ 阻断项

无。

## 审查结论

迭代二代码通过审查。分层正确、无硬编码密钥、错误处理充分、预设系统完整对齐。注意项均为非阻断，可在后续迭代中处理。
