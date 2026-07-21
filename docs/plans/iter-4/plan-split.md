# 迭代四：工具链（最小集）— Plan 拆分

## 迭代目标

Agent 能调工具操作文件和执行命令。

**验证标准**：让 Agent "读取某文件内容并总结"，Agent 能调 FsRead 拿到内容并回复。

## Plan 拆分

| Plan | 内容 | 独立验证 | 预估会话量 |
|------|------|----------|-----------|
| plan-001 | 后端工具框架 + 文件工具 + Shell 工具 | `dotnet build` + 单元测试 | 1次会话 |
| plan-002 | AgentLoop 工具执行集成 + 前端工具 UI | 端到端验证（Agent调工具→回传→继续对话） | 1次会话 |

### plan-001：后端工具框架 + 文件/Shell 工具

**目标**：搬入 OpenCowork 工具框架和最小集工具实现，能独立编译。

**步骤**：
1. 新建 `WishfulClaw.Core/Tools/` — 工具基类和接口（IToolExecutor / ToolResult / ToolDefinition）
2. 搬入文件工具（Read/Write/Edit/LS）— 从 OpenCowork FileTools.cs + NativeToolExecutor.cs 提取
3. 搬入搜索工具（Glob/Grep）— 从 OpenCowork NativeToolExecutor.cs 提取
4. 搬入 Shell 工具（Bash/Shell）— 从 OpenCowork ShellTools.cs 提取
5. 工具注册器（ToolRegistry）— 注册所有工具，提供查询接口
6. 验证：`dotnet build` 通过

**参考源码**：
- `D:\gy\OpenCowork\sidecars\OpenCowork.Native.Worker\Modules\AgentRuntime\AgentRuntimeNativeToolExecutor.cs`（Read/Write/Edit/Glob/Grep/LS 实现）
- `D:\gy\OpenCowork\sidecars\OpenCowork.Native.Worker\Modules\Shell\ShellTools.cs`（Shell 执行）
- `D:\gy\OpenCowork\sidecars\OpenCowork.Native.Worker\Modules\File\FileTools.cs`（文件操作辅助）

### plan-002：AgentLoop 工具执行集成 + 前端工具 UI

**目标**：AgentLoop 能执行工具、回传结果、继续循环；前端能展示工具调用卡片。

**步骤**：
1. 修改 AgentLoop.cs — 替换占位代码，加入工具执行 + 结果回传 + 继续循环
2. 修改前端 sendMessage — 传入 tools 定义 + workingFolder
3. 搬入前端工具 UI（ToolCallCard / ToolCallGroup 精简版）
4. 修改 AssistantMessage — 解析并渲染 tool_use 内容块
5. 修改 activity-store — 处理工具调用事件
6. 验证：端到端 — 发消息让 Agent 读文件，Agent 调 FsRead → 展示工具卡片 → 返回总结

**参考源码**：
- `D:\gy\OpenCowork\src\renderer\src\components\chat\ToolCallCard.tsx`（3538行，精简搬入）
- `D:\gy\OpenCowork\src\renderer\src\components\chat\ToolCallGroup.tsx`（172行，直接搬入）
- `D:\gy\OpenCowork\src\renderer\src\components\chat\CompactToolCallHeader.tsx`（211行，精简搬入）
- `D:\gy\OpenCowork\src\renderer\src\components\chat\AssistantMessage.tsx`（3277行，精简搬入）

## 依赖顺序

```
plan-001（后端工具） → plan-002（集成 + 前端 UI）
```

plan-001 必须先完成，plan-002 依赖工具框架和工具实现。
