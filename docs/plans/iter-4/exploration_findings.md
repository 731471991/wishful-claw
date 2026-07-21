# 探索报告：迭代四 — 工具链（最小集）

## 当前项目状态

### 后端（已完成迭代三）

AgentLoop 已实现完整循环，但工具执行是占位状态：
- `AgentLoop.cs` 第184行：`// ── Placeholder: tool execution (iteration 4) ──`
- 模型返回 tool_calls 时，直接 emit iteration_end + 停止循环
- 不执行任何工具，不回传结果

已具备的基础设施：
- `AgentRuntimeNativeToolCall`（Id/Name/Input）— 模型返回的工具调用解析
- `AgentRuntimeToolResult`（ToolUseId/Content/IsError）— 工具结果类型
- `AgentRuntimeChatMessage.UserToolResults()` — 构造工具结果消息
- Provider 已支持 tools 参数序列化（OpenAIChatProvider 第212-340行写入 tools 数组）
- AnthropicMessagesProvider 同样支持

### 前端（已完成迭代三修复）

- `use-chat-actions.ts` 中 sendMessage 不传 tools 参数
- `AssistantMessage.tsx` 不解析 tool_use 内容
- `MessageList.tsx` 不渲染工具调用卡片
- ActivityPanel 已有工具活动事件展示基础

## OpenCowork 源码分析

### 工具执行架构

OpenCowork 的工具执行是**Executor 模式**，核心分发在 `AgentRuntimeNativeToolExecutor.cs`（2260行）：

```
AgentLoop 检测到 tool_calls
  ↓
AgentRuntimeNativeToolExecutor.CanExecute(toolName, parameters) → bool
  ↓
AgentRuntimeNativeToolExecutor.ExecuteAsync(call, parameters, state, context, ct)
  ↓
按 toolName 分发：
  - "Read" → ReadAsync()       — 读文件，支持行范围/limit
  - "Write" → WriteAsync()     — 写文件
  - "Edit" → EditAsync()       — 精确查找替换
  - "LS" → ExecuteLsAsync()    — 列目录
  - "Glob" → ExecuteGlobAsync() — 文件模式匹配
  - "Grep" → GrepAsync()       — 内容搜索
  - "Bash"/"Shell" → ExecuteShellAsync() — 执行命令
  - 其余 → 各 Executor（Memory/SubAgent/Browser/...）
```

### 关键设计点

1. **工具定义格式**：前端传 `tools: [{name, description, inputSchema}]`，后端原样转成 Provider 格式
2. **工具结果格式**：`RendererToolResult(JsonElement Content, bool IsError, string? Error)`
3. **Read 历史**：维护文件快照，Edit 时验证文件是否被 Read 过（Claude Code 语义）
4. **Shell 超时**：默认 600s，最大 3600s，输出截断 12000 字符
5. **工作目录**：从 parameters 中的 `workingFolder` 获取

### 前端工具 UI

OpenCowork 的工具调用 UI 组件（做减法后保留）：

| 组件 | 行数 | 作用 | 保留 |
|------|------|------|------|
| ToolCallCard.tsx | 3538 | 单个工具调用卡片（输入/输出/折叠） | ✅ 精简搬入 |
| ToolCallGroup.tsx | 172 | 同类工具分组折叠 | ✅ 直接搬入 |
| CompactToolCallHeader.tsx | 211 | 紧凑工具头部 | ✅ 精简搬入 |
| AssistantMessage.tsx | 3277 | 消息渲染（含工具调用嵌入） | ✅ 精简搬入 |
| tool-call-summary.ts | — | 工具输入摘要 | ✅ 搬入 |
| CollapsibleHeightPanel.tsx | — | 折叠面板 | ✅ 搬入 |

不需要的组件（MVP 砍掉）：
- BrowserToolCard / CodeGraphToolCard / DesktopActionToolCard
- ExtensionToolResultCard / ImagePluginToolCard / SubAgentCard
- TeamEventCard / PlanReviewCard / TodoCard

### 工具定义来源

OpenCowork 前端在 `use-chat-actions.ts` 中构建 `tools` 数组，传给 `agent/run`。
我们需要在后端定义工具列表（或前端定义后传入），格式为 `{name, description, inputSchema}`。

## 潜在风险

1. **AgentLoop 改动**：需要修改占位区域，加入工具执行 + 结果回传 + 继续循环逻辑
2. **工作目录**：当前 sendMessage 不传 workingFolder，需要从前端 session.project.workingFolder 传入
3. **工具 UI 前端依赖**：ToolCallCard 依赖大量 OpenCowork 组件（Markdown 渲染/语法高亮/IPC），需要精简
4. **Anthropic 格式差异**：Anthropic 的 tool_use 和 OpenAI 的 tool_calls 格式不同，两套 Provider 都要适配
5. **安全边界**：Shell 工具需要限制工作目录、超时、输出截断

## 参考

- OpenCowork 源码路径：`D:\gy\OpenCowork`
- 工具执行器：`sidecars/OpenCowork.Native.Worker/Modules/AgentRuntime/AgentRuntimeNativeToolExecutor.cs`
- 文件工具：`sidecars/OpenCowork.Native.Worker/Modules/File/FileTools.cs`
- Shell 工具：`sidecars/OpenCowork.Native.Worker/Modules/Shell/ShellTools.cs`
- 前端工具 UI：`src/renderer/src/components/chat/ToolCallCard.tsx`
- 工具定义类型：`src/renderer/src/lib/api/types.ts:353`
