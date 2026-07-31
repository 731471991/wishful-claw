# Plan 1: Infrastructure 层创建 + Db/Storage/Http 下沉

## 目标

新建 `WishfulClaw.Infrastructure` 项目，将 Db/Storage/Http 基础设施从 Worker 和 Agent 下沉。

## 依赖链分析

### 当前引用关系
```
Contracts ← Core ← Workspace ← Persona ← Agent ← Worker
                                     └──────────────┘
```

### 目标引用关系
```
Contracts ← Core ← Infrastructure ← Workspace ← Persona ← Agent ← Worker
                                                  └──────────┘
```

### 待搬迁文件

| 类别 | 源位置 | 目标位置 | 命名空间变化 |
|------|--------|----------|-------------|
| Db | Worker/Modules/Db/DbClient.cs | Infrastructure/Db/DbClient.cs | Worker.Modules.Db → Infrastructure.Db |
| Db | Worker/Modules/Db/Entities/*.cs (8文件) | Infrastructure/Db/Entities/*.cs | Worker.Modules.Db → Infrastructure.Db |
| Storage | Worker/ConfigStore.cs | Infrastructure/Storage/ConfigStore.cs | Worker → Infrastructure.Storage |
| Storage | Worker/ProviderStore.cs | Infrastructure/Storage/ProviderStore.cs | Worker → Infrastructure.Storage |
| Storage | Worker/JsonFileNodeCache.cs | Infrastructure/Storage/JsonFileNodeCache.cs | Worker → Infrastructure.Storage |
| Http | Agent/WorkerHttpClientFactory.cs | Infrastructure/Http/WorkerHttpClientFactory.cs | Agent → Infrastructure.Http |

### 留在 Worker 的 Db 相关文件（业务逻辑，非基础设施）
- DbModule.cs, DbMessageTools.cs, DbMessageCompactTools.cs, DbProjectTools.cs, DbSessionTools.cs, DbSshTools.cs, DbSubAgentTools.cs, DbPluginSession*.cs

这些文件引用 DbClient/Entities，搬迁后只需更新 using 语句。

## 执行步骤

### 步骤 1-4: 创建项目 + 搬入文件
1. 创建 `WishfulClaw.Infrastructure` 项目 + csproj（引用 Contracts + Core，含 SqlSugarCore 包）
2. 搬入 Db: DbClient.cs + Entities/*.cs，改命名空间
3. 搬入 Storage: ConfigStore.cs + ProviderStore.cs + JsonFileNodeCache.cs，改命名空间
4. 搬入 Http: WorkerHttpClientFactory.cs，改命名空间

### 步骤 5: 更新引用关系
- Infrastructure.csproj: 引用 Contracts + Core
- Agent.csproj: 添加 Infrastructure 引用
- Worker.csproj: 添加 Infrastructure 引用
- Worker 中 SqlSugarCore 包可移除（由 Infrastructure 提供）

### 步骤 6: 更新所有 using 语句
- Worker 中引用 Db 命名空间的文件（~15个）
- Worker 中引用 Storage 命名空间的文件（~12个）
- Agent/Worker 中引用 Http 命名空间的文件（~6个）

### 步骤 7: 更新 sln
- 添加 Infrastructure 项目到 sln

### 步骤 8: 编译验证
- dotnet build 零错误
- npx tsc --noEmit -p tsconfig.web.json 零错误

## 验证标准
- 编译通过
- 应用启动正常
- 核心对话 + 工具调用 + 记忆 + 人格 + DB 读写全链路不回归
