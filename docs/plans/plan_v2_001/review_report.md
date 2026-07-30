# 审查报告：v2-iter-1 Runtime 分层架构重构

## 审查项

### 1. 分层约定 ✅

| 项目 | 依赖 | 符合约定 |
|------|------|----------|
| Contracts | 无 | ✅ |
| Core | → Contracts | ✅ |
| Workspace | → Contracts | ✅ |
| Agent | → Core, Contracts, Persona | ✅ |
| Persona | → Core, Contracts, Workspace | ✅ |
| Worker | → Agent, Persona, Core, Workspace, Contracts | ✅ |

无循环依赖。Agent → Persona → Workspace → Contracts 链路正确。

### 2. 硬编码路径/密钥 ✅

未引入硬编码路径或密钥。所有文件迁移仅改命名空间和可见性，未改逻辑。

### 3. 参考源码适配 ✅

纯项目内重构，未从外部搬入代码。

### 4. 错误处理 ✅

未修改任何错误处理逻辑。所有 try-catch、异常处理保持原样。

### 5. 不需要的依赖 ✅

未引入新的 NuGet 包。Agent.csproj 仅引用项目依赖。Persona.csproj 同理。

## 额外发现

### 迁移过程中解决的问题

1. **MemoryRecallService 循环依赖**：原在 `WishfulClaw.Worker.Memory`，Agent 中的 AgentLoop.MemoryRecall.cs 需要创建其实例。移到 `WishfulClaw.Workspace.Memory`（实现 IMemoryRecall 接口，接口已在 Workspace），打破循环依赖。

2. **ToolModuleState 命名空间**：原在 `WishfulClaw.Worker.Tools`，Agent 的 ToolCallProcessor 和 AgentLoop.MemoryRecall 都引用它。移到 `WishfulClaw.Agent` 命名空间（依赖 ToolRegistry + IMemorySearch），Worker 通过项目引用访问。

3. **相对命名空间引用**：Worker 中 `AgentRuntime.SubAgentRegistry` 等引用是相对于 `WishfulClaw.Worker` 的。迁移后需改为 `Agent.SubAgentRegistry`。

4. **RendererToolResult 可见性**：`internal readonly record struct` 在 Agent 中被 public 方法返回，改为 `public`。

### 未拆分的大文件（留后续迭代）

| 文件 | 行数 | 所属项目 | 备注 |
|------|------|----------|------|
| ShellExecuteTool.cs | 889 | Worker/Tools | 不涉及本次迁移 |
| SubAgentExecutor.cs | 690 | Agent | 后续可拆 |
| ToolDispatchRouter.cs | 477 | Agent | 后续可拆 |
| AgentRuntimeDesktopExecutor.cs | 429 | Agent | 后续可拆 |

## 审查结论

❌ 项：0
✅ 项：5/5

**通过审查，可进入验证态。**
