# 规划验证报告：迭代十五

## 检查项

| # | 检查项 | 结果 | 说明 |
|---|--------|------|------|
| 1 | 步骤是否完整覆盖任务目标 | ✅ | 6 步覆盖：types → mcp-tools → dynamic-catalog → McpPanel → SettingsPage → i18n |
| 2 | 每步是否有明确的验证检查点 | ✅ | 每步均有 tsc 验证 + 功能验证 |
| 3 | 文件路径是否符合项目结构（AGENTS.md） | ✅ | settings 组件在 `src/renderer/src/components/settings/`，lib 在 `src/renderer/src/lib/mcp/` |
| 4 | 分层依赖是否正确 | ✅ | 前端 lib → tools → components，不涉及后端（后端已完整） |
| 5 | 是否参考了正确的源码文件 | ✅ | OpenCowork mcp-tools.ts + McpPanel.tsx + types.ts |
| 6 | McpPanel 是否需要拆分 | ✅ | OpenCowork 原始 963 行，计划拆为 3 个文件（mcp-panel + mcp-server-config + mcp-add-dialog） |
| 7 | types.ts 是否需要完善 | ✅ | 当前是 stub，缺 McpTransportType；步骤1 处理 |
| 8 | dynamic-tool-catalog 接入 | ✅ | 步骤3 添加 refreshMcpTools |
| 9 | IPC 通道是否已就绪 | ✅ | mcp-handlers.ts 已注册 16 个通道，index.ts 已调用 registerMcpHandlers() |
| 10 | Worker 侧执行器是否已就绪 | ✅ | AgentRuntimeMcpExecutor.cs 完整，mcp__* 工具调用走 reverse-request |

## 阻断项

❌ 项 = 0，可进入用户确认环节。

## 补充说明

- MCP 工具注册时机：步骤3 中 refreshMcpTools 需从 mcp-store 获取已连接服务器的工具列表，注册到 toolRegistry
- 工具执行：Agent 调用 mcp__* 工具时，Worker 侧 AgentRuntimeMcpExecutor 已处理，通过 reverse-request 到 Main 的 mcp:call-tool
- SettingsPage 集成：复用迭代十四的"扩展"分组，在 Skills 旁边加 MCP 菜单项
