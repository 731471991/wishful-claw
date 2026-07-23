# Plan 6-2: PersonaModule IPC 端点

## 目标

将 PersonaStore 通过 IPC 端点暴露给前端，让设置页面能列表、查看、保存、删除人格，以及复制人格到项目。前端能调通数据层是后续所有 UI 工作的前提。

## 步骤清单

- [ ] 步骤1：PersonaModule + IPC 端点注册
  - 新建 `src/runtime/WishfulClaw.Worker/Persona/PersonaModule.cs`
  - 实现 IWorkerModule，注册端点：persona/list、persona/get、persona/save、persona/delete、persona/apply-to-project
  - 在 WorkerHostBuilder 中注册 PersonaModule
  - 验证：`dotnet build` 通过

- [ ] 步骤2：端点逻辑实现
  - persona/list：调用 PersonaStore.ListPersonas，返回 PersonaSummary 列表
  - persona/get：调用 PersonaStore.GetPersona，返回完整 PersonaConfig
  - persona/save：接收 PersonaConfig，调用 PersonaStore.SavePersona
  - persona/delete：调用 PersonaStore.DeletePersona，内置预设不可删
  - persona/apply-to-project：调用 PersonaStore.CopyToProject
  - 验证：`dotnet build` 通过，编译无报错

## 涉及文件

### 新建
- `src/runtime/WishfulClaw.Worker/Persona/PersonaModule.cs`

### 修改
- `src/runtime/WishfulClaw.Worker/WorkerHostBuilder.cs` — 注册 PersonaModule

## 参考源码
- 项目内 `ConfigModule.cs` — IWorkerModule 实现模式
- 项目内 `ProviderModule.cs` — 带参数的 IPC 端点模式
