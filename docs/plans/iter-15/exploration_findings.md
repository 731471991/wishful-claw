# 迭代十五：MCP 管理 — 探索发现

## 现状概述

MCP 基础设施在 wishful-claw 中已大量预置，但关键链路断开：

| 层 | 状态 | 详情 |
|----|------|------|
| Main 进程 MCP Client | ✅ 完整 | mcp-client.ts (349行) + mcp-manager.ts (155行) + mcp-types.ts (66行) |
| Main IPC Handlers | ✅ 完整 | mcp-handlers.ts (264行)，16 个通道，已注册 |
| MCP SDK | ✅ 已安装 | @modelcontextprotocol/sdk，支持 stdio/sse/streamable-http |
| 前端 mcp-store | ✅ 完整 | mcp-store.ts (401行)，CRUD + 连接管理 + 项目激活 |
| 前端 mcp-tools.ts | ❌ Stub | isMcpTool 永远返回 false，无 registerMcpTools 实现 |
| 前端 MCP types | ⚠️ 不足 | types.ts 是简化 stub，缺 McpTransportType 等 |
| dynamic-tool-catalog | ❌ 未接入 | refreshDynamicToolCatalog 不含 MCP 工具刷新 |
| SettingsPage | ❌ 无 MCP | 无 McpPanel 渲染分支，无菜单项 |
| i18n | ❌ 无 MCP | zh/en settings.json 无 mcp.* 翻译 |
| Worker 侧执行器 | ✅ 完整 | AgentRuntimeMcpExecutor.cs (145行)，mcp__* 工具调用走 reverse-request |

## 关键发现

### 1. 后端链路已通

Main 进程的 MCP 管理完整：
- `McpClientWrapper` 支持 stdio/sse/streamable-http 三种传输，自动 fallback
- `McpManager` 管理多连接生命周期
- `mcp-handlers.ts` 16 个 IPC 通道全部注册（mcp:list/add/update/remove/connect/disconnect/...）
- 配置持久化到 `~/.wishful-claw/mcp-servers.json`

Worker 侧 `AgentRuntimeMcpExecutor.cs` 已实现：
- 工具名解析 `mcp__{serverId}__{toolName}` → reverse-request 到 Main
- 资源名解析 `mcp__{serverId}__resource__{resourceName}`
- 调用 `mcp:call-tool` / `mcp:read-resource` IPC

### 2. 前端链路断点

**断点 A：mcp-tools.ts 是 stub**
- `isMcpTool()` 返回 false
- 没有 `registerMcpTools()` / `unregisterMcpTools()`
- OpenCowork 有完整实现（149行），可直接适配搬入

**断点 B：dynamic-tool-catalog 不含 MCP**
- `refreshDynamicToolCatalog()` 只刷新 Skill + SubAgent + Extension
- 需要添加 `refreshMcpTools()` 调用

**断点 C：无 McpPanel 设置页面**
- SettingsPage.tsx 无 MCP 渲染分支
- OpenCowork 有完整 McpPanel.tsx (963行)，左右分栏布局 + 服务器配置 + 工具/资源/Prompt 展示 + JSON 导入

**断点 D：无 i18n**
- zh/en settings.json 无 `mcp.*` 翻译 key

### 3. 前端 mcp-store 已完整

mcp-store.ts 功能完整：
- CRUD：addServer/updateServer/removeServer
- 连接管理：connectServer/disconnectServer/refreshServerInfo/refreshAllServers
- 项目激活：toggleActiveMcp/getActiveMcps/getActiveMcpTools
- ensureConversationReady：会话开始时自动连接配置的 MCP 服务器

### 4. InputArea 已有 MCP Badge

`badges.tsx` 中 `ActiveMcpsBadge` 已实现，显示当前活跃的 MCP 服务器和工具数量。

### 5. SettingsTab 已有 'mcp'

`ui-types.ts` 和 `settings-route.ts` 已定义 `mcp` tab，只是 SettingsPage 没有渲染分支。

## 参考源码

| 文件 | 用途 |
|------|------|
| `D:\claw\OpenCowork\src\renderer\src\lib\mcp\mcp-tools.ts` | MCP 工具注册到 toolRegistry，直接适配搬入 |
| `D:\claw\OpenCowork\src\renderer\src\components\settings\McpPanel.tsx` | MCP 设置面板 UI，963行，需拆分 |
| `D:\claw\OpenCowork\src\renderer\src\lib\mcp\types.ts` | MCP 类型定义（完整版） |
| `D:\claw\OpenCowork\src\renderer\src\stores\mcp-store.ts` | 已有，功能一致 |

## Reasonix 参考要点

Reasonix（Go 实现的 DeepSeek Agent）的 MCP 管理有以下值得参考的设计：

| 设计 | 说明 | 是否纳入本次 |
|------|------|-------------|
| `.mcp.json` 兼容 | 支持读取 Claude Code 格式的 `.mcp.json`，用户可直接复用已有配置 | 可选增强 |
| 激活/禁用分离 | 独立 `mcp-activation.json` 记录启用/禁用，区分 global/workspace scope | 已有类似（mcp-store activeMcpIdsByProject）|
| 工具超时配置 | `call_timeout_seconds` + `tool_timeout_seconds`（per-tool 超时） | 后续增强 |
| 认证状态检测 | `authStatus`（required/possible），支持清除认证 | 后续增强 |
| 配置来源分层 | built-in / project .mcp.json / global config，有优先级合并 | 后续增强 |
| 生命周期状态 | idle/connecting/ready/issue 四态，比我们的 connected/disconnecting/connecting/error 更细 | 后续增强 |

**核心借鉴**：`.mcp.json` 兼容可以作为 JSON 导入的增强——OpenCowork 的 McpPanel 已有 JSON 导入功能，Reasonix 的 `.mcp.json` 格式与之一致（都是 `mcpServers` map），无需额外适配。其余增强项留到后续迭代。

## 潜在风险

1. **McpPanel.tsx 963 行超标** — OpenCowork 原始文件超 AGENTS.md 500 行限制，搬入时需拆分为列表 + 配置面板 + 添加对话框
2. **types.ts 不完整** — 前端 types.ts 缺 `McpTransportType` 等类型，需从 OpenCowork 同步或从 main/mcp/mcp-types.ts 对齐
3. **工具注册时机** — MCP 工具依赖服务器连接后才能获取工具列表，注册时机与 Skill 不同（Skill 是静态的，MCP 是动态的）
4. **连接状态同步** — 前端需要感知连接/断开事件来动态注册/注销工具，需要监听 store 变化
