# Plan: v2-iter-1 Runtime 分层架构重构

## 目标

将 Worker 项目（192 文件/29k 行）拆分为 `WishfulClaw.Agent` + `WishfulClaw.Persona` 两个独立项目，Worker 回归薄层 IPC 宿主。编译通过，功能不回归。

## 步骤清单

- [✓] 步骤1：创建 WishfulClaw.Agent 项目骨架 — 新建 csproj + 目录结构，注册到 sln，配置项目引用（Core + Contracts）。验证：sln 能加载，空项目能编译。
- [✓] 步骤2：创建 WishfulClaw.Persona 项目骨架 — 新建 csproj + 目录结构，注册到 sln，配置项目引用（Core + Contracts + Workspace）。验证：sln 能加载，空项目能编译。
- [✓] 步骤3：迁移共享类型到 Core — 将 AgentRuntimeNativeToolCall（ToolModels.cs 中的 record）和 AgentRuntimeReverseRequests 移到 Core。更新所有引用。验证：dotnet build 通过。
- [✓] 步骤4：迁移 WorkerHttpClientFactory 到 Agent — 移动 Runtime/WorkerHttpClientFactory.cs 到 Agent 项目，改命名空间。验证：dotnet build 通过。
- [✓] 步骤5：迁移 Persona 9 文件到 Persona 项目 — 移动文件，改命名空间 `WishfulClaw.Worker.Persona` → `WishfulClaw.Persona`，改可见性（internal → public），更新 Worker 中的引用。验证：dotnet build 通过。
- [✓] 步骤6：迁移 AgentRuntime 65 文件到 Agent 项目 — 移动文件，改命名空间 `WishfulClaw.Worker.AgentRuntime` → `WishfulClaw.Agent`，改可见性（internal → public），更新 Worker 中的引用。验证：dotnet build 通过。
- [✓] 步骤7：迁移 Tools 框架代码到 Core — 移动 ToolSchemaBuilder、ToolDefinitionPlaceholder、ToolModuleState 到 Core，改命名空间和可见性。验证：dotnet build 通过。
- [✓] 步骤8：Worker 引用 Agent + Persona — 更新 Worker.csproj 添加 Agent + Persona 引用，更新 WorkerModuleCatalog 的 using，清理无用 using。验证：dotnet build 通过。
- [✓] 步骤9：全量编译验证 — `dotnet build` 零错误 + `npx tsc --noEmit -p tsconfig.web.json` 零错误。应用启动正常。

## 涉及文件

### 新建
- `src/runtime/WishfulClaw.Agent/WishfulClaw.Agent.csproj` — 新项目文件
- `src/runtime/WishfulClaw.Persona/WishfulClaw.Persona.csproj` — 新项目文件
- `src/runtime/WishfulClaw.Agent/` — 65 个 .cs 文件（从 Worker/AgentRuntime/ 迁入）
- `src/runtime/WishfulClaw.Persona/` — 9 个 .cs 文件（从 Worker/Persona/ 迁入）

### 修改
- `src/runtime/WishfulClaw.sln` — 添加两个新项目
- `src/runtime/WishfulClaw.Core/Tools/` — 新增 ToolModels.cs（NativeToolCall）、ToolModuleState.cs、ToolSchemaBuilder.cs、ToolDefinitionPlaceholder.cs
- `src/runtime/WishfulClaw.Core/Protocol/` — 新增 ReverseRequests.cs
- `src/runtime/WishfulClaw.Worker/WishfulClaw.Worker.csproj` — 添加 Agent + Persona 引用
- `src/runtime/WishfulClaw.Worker/WorkerModuleCatalog.cs` — 更新 using
- `src/runtime/WishfulClaw.Worker/Modules/**/*.cs` — 更新 using（全局替换命名空间）
- `src/runtime/WishfulClaw.Worker/Tools/**/*.cs` — 更新 using

### 删除（从 Worker 移走后）
- `src/runtime/WishfulClaw.Worker/AgentRuntime/` — 整个目录
- `src/runtime/WishfulClaw.Worker/Persona/` — 整个目录
- `src/runtime/WishfulClaw.Worker/Runtime/` — 整个目录

## 参考源码

- 无需参考外部源码，纯项目内重构。

## 执行策略

**先搬过来跑通，再优化**：步骤 5-6 是大块迁移，先批量移动文件 + 全局替换命名空间，确保编译通过，不做逻辑修改。可见性变更（internal → public）是机械性操作，编译错误驱动修复。

**命名空间映射**：
- `WishfulClaw.Worker.AgentRuntime` → `WishfulClaw.Agent`
- `WishfulClaw.Worker.AgentRuntime.Models` → `WishfulClaw.Agent.Models`
- `WishfulClaw.Worker.Persona` → `WishfulClaw.Persona`
- `WishfulClaw.Worker.Runtime` → `WishfulClaw.Agent`（HttpClientFactory 合并）

**可见性变更原则**：
- 迁入 Agent/Persona 的类：internal → public（Worker 需要访问）
- 留在 Worker 的 Modules/Tools 中的类：保持 internal
- 移到 Core 的类：internal → public
