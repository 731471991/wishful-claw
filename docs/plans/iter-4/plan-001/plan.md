# Plan: 迭代四 plan-001 — 后端工具框架 + 文件/Shell 工具

## 目标

从 OpenCowork 搬入工具框架和最小集工具（Read/Write/Edit/LS/Glob/Grep/Bash），能独立编译通过。

## 步骤清单

- [✓] 步骤1：工具框架 — IToolExecutor 接口 + ToolRegistry + ToolDefinition + ToolResult
  - 新建 `WishfulClaw.Core/Tools/IToolExecutor.cs` — 工具执行器接口
  - 新建 `WishfulClaw.Core/Tools/ToolRegistry.cs` — 工具注册器（注册/查询/列举）
  - 新建 `WishfulClaw.Core/Tools/ToolTypes.cs` — ToolDefinition / ToolResult / ToolExecutionContext
  - 验证：`dotnet build` 通过

- [✓] 步骤2：文件工具 — Read / Write / Edit / LS
  - 新建 `WishfulClaw.Worker/Tools/FileTools/FileReadTool.cs` — 读文件（支持行范围/limit/offset）
  - 新建 `WishfulClaw.Worker/Tools/FileTools/FileWriteTool.cs` — 写文件
  - 新建 `WishfulClaw.Worker/Tools/FileTools/FileEditTool.cs` — 精确查找替换
  - 新建 `WishfulClaw.Worker/Tools/FileTools/FileListTool.cs` — 列目录（LS）
  - 从 OpenCowork `AgentRuntimeNativeToolExecutor.cs` 搬入核心逻辑，适配命名空间
  - 验证：`dotnet build` 通过

- [✓] 步骤3：搜索工具 — Glob / Grep
  - 新建 `WishfulClaw.Worker/Tools/SearchTools/GlobTool.cs` — 文件模式匹配
  - 新建 `WishfulClaw.Worker/Tools/SearchTools/GrepTool.cs` — 内容搜索
  - 从 OpenCowork `AgentRuntimeNativeToolExecutor.cs` 搬入 Glob/Grep 实现
  - 验证：`dotnet build` 通过

- [✓] 步骤4：Shell 工具 — Bash / Shell
  - 新建 `WishfulClaw.Worker/Tools/ShellTools/ShellExecuteTool.cs` — 执行命令（超时/输出截断/工作目录）
  - 从 OpenCowork `ShellTools.cs` 搬入核心逻辑
  - 验证：`dotnet build` 通过

- [✓] 步骤5：工具注册 — 在 Worker Module 中注册所有工具
  - 新建 `WishfulClaw.Worker/Tools/ToolModule.cs` — IWorkerModule，注册工具到 ToolRegistry
  - 修改 `WorkerHostBuilder.cs` — 注册 ToolModule
  - 验证：`dotnet build` 通过 + 工具列表可查询

## 涉及文件

### 新建
- `src/runtime/WishfulClaw.Core/Tools/IToolExecutor.cs`
- `src/runtime/WishfulClaw.Core/Tools/ToolRegistry.cs`
- `src/runtime/WishfulClaw.Core/Tools/ToolTypes.cs`
- `src/runtime/WishfulClaw.Worker/Tools/FileTools/FileReadTool.cs`
- `src/runtime/WishfulClaw.Worker/Tools/FileTools/FileWriteTool.cs`
- `src/runtime/WishfulClaw.Worker/Tools/FileTools/FileEditTool.cs`
- `src/runtime/WishfulClaw.Worker/Tools/FileTools/FileListTool.cs`
- `src/runtime/WishfulClaw.Worker/Tools/SearchTools/GlobTool.cs`
- `src/runtime/WishfulClaw.Worker/Tools/SearchTools/GrepTool.cs`
- `src/runtime/WishfulClaw.Worker/Tools/ShellTools/ShellExecuteTool.cs`
- `src/runtime/WishfulClaw.Worker/Tools/ToolModule.cs`

### 修改
- `src/runtime/WishfulClaw.Worker/WorkerHostBuilder.cs` — 注册 ToolModule

## 参考源码

- `D:\gy\OpenCowork\sidecars\OpenCowork.Native.Worker\Modules\AgentRuntime\AgentRuntimeNativeToolExecutor.cs` — Read/Write/Edit/Glob/Grep/LS 实现（行580-2260）
- `D:\gy\OpenCowork\sidecars\OpenCowork.Native.Worker\Modules\Shell\ShellTools.cs` — Shell 执行（432行）
- `D:\gy\OpenCowork\sidecars\OpenCowork.Native.Worker\Modules\File\FileTools.cs` — 文件辅助（2046行）
