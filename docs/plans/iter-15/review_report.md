# 审查报告：迭代十五 — MCP 管理

## 审查范围

| 步骤 | 内容 | 状态 |
|------|------|------|
| 步骤1 | 完善前端 MCP types | ✅ 已完成 |
| 步骤2 | 实现 mcp-tools.ts | ✅ 已完成 |
| 步骤3 | 接入 dynamic-tool-catalog | ✅ 已完成 |
| 步骤4 | 创建 McpPanel 设置页面（3 文件拆分） | ✅ 已完成 |
| 步骤5 | SettingsPage 集成 | ✅ 已完成 |
| 步骤6 | i18n zh/en | ✅ 已完成 |

## 编译验证

| 验证项 | 命令 | 结果 |
|--------|------|------|
| TypeScript 前端 | `npx tsc --noEmit -p tsconfig.web.json` | 0 新增错误（pre-existing TS6133 不计） |

注：`AssistantMessage/index.tsx` 中 `isMcpTool` 导入未使用是 pre-existing 问题（搬入时遗留），非本次引入。

## 代码审查

### 前端 lib 层

**types.ts**（60行）
- 从 OpenCowork 同步完整类型定义
- 新增 McpTransportType、McpServerConfig（完整字段）、McpTool、McpResource、McpPrompt、McpServerInfo
- 与 main/mcp/mcp-types.ts 字段对齐

**mcp-tools.ts**（146行）
- isMcpTool：检查 `mcp__` 前缀（之前返回 false）
- parseMcpToolName：解析 `mcp__{serverId}__{toolName}` 格式
- registerMcpTools：遍历活跃服务器，为每个工具注册 ToolHandler
- registerMcpResources：将 MCP 资源也注册为工具
- unregisterMcpTools：清理已注册的工具
- 工具执行走 .NET Native Worker（renderer 只保持定义）

**mcp-tool.ts**（53行，新建）
- refreshMcpTools：从 mcp-store 获取已连接服务器的工具列表，注册到 toolRegistry
- 签名比对机制：仅在工具列表变化时重新注册，避免频繁操作

**dynamic-tool-catalog.ts**（23行→27行）
- 添加 refreshMcpTools 到刷新链路
- 执行顺序：Skill → SubAgent → Extension → MCP

### 前端 UI 层

**mcp-panel.tsx**（198行）
- 左右分栏：左侧服务器列表（搜索 + 启用/禁用分组），右侧配置面板
- 服务器列表显示连接状态指示灯
- 空状态提示

**mcp-server-config.tsx**（440行）
- 服务器配置面板：名称、描述、传输方式选择
- stdio 配置：command、args、cwd、env
- HTTP 配置：url、headers、autoFallback
- 连接控制：connect/disconnect/refresh 按钮 + 状态指示
- 能力展示：tools/resources/prompts 三个 tab
- 防抖保存（500ms）
- 启用/禁用 Switch 开关
- 删除确认对话框

**mcp-add-dialog.tsx**（192行）
- 手动创建：输入名称 + 选择传输方式
- JSON 导入：支持 Claude Code `.mcp.json` 格式（`mcpServers` map）
- 导入解析：自动推断传输方式（有 url → http/sse，有 command → stdio）

### SettingsPage 集成

- 扩展分组添加 MCP 菜单项（Cable 图标）
- 渲染分支：`settingsTab === 'mcp'` → `<McpPanel />`
- import 使用 kebab-case 文件名

### i18n

- zh/en 各添加 50+ mcp.* 翻译条目
- tabs.mcp.label 添加

## IPC 通道验证

所有 16 个 MCP IPC 通道在 mcp-handlers.ts 中已注册（迭代十二完成），本次无需修改后端。

## 文件清单

### 新建（5 个文件）
1. `src/renderer/src/lib/tools/mcp-tool.ts` — refreshMcpTools 实现
2. `src/renderer/src/components/settings/mcp-panel.tsx` — 主面板
3. `src/renderer/src/components/settings/mcp-server-config.tsx` — 服务器配置面板
4. `src/renderer/src/components/settings/mcp-add-dialog.tsx` — 添加服务器对话框

### 修改（5 个文件）
1. `src/renderer/src/lib/mcp/types.ts` — 完善类型定义
2. `src/renderer/src/lib/mcp/mcp-tools.ts` — 从 stub 改为完整实现
3. `src/renderer/src/lib/tools/dynamic-tool-catalog.ts` — 添加 MCP 刷新
4. `src/renderer/src/components/settings/SettingsPage.tsx` — 添加 MCP 菜单和渲染
5. `src/renderer/src/locales/{zh,en}/settings.json` — mcp.* 翻译

## 潜在问题

| # | 问题 | 严重度 | 说明 |
|---|------|--------|------|
| 1 | 运行时 E2E 验证未执行 | 中 | 需启动应用测试完整流程 |
| 2 | MCP 工具注册时机依赖连接状态 | 低 | 需确保 connectServer 后 refreshMcpTools 被触发 |
| 3 | AssistantMessage isMcpTool 未使用导入 | 低 | Pre-existing，非本次引入 |

## Commit 序列

| Commit | 描述 |
|--------|------|
| `93fc2c4` | docs(plan): 规划 + 探索 + 验证 |
| `ee3d405` | feat(mcp): 步骤1 — types |
| `843c407` | feat(mcp): 步骤2 — mcp-tools.ts |
| `ab800fc` | feat(mcp): 步骤3 — dynamic-tool-catalog |
| `5a3cecf` | feat(mcp): 步骤4 — McpPanel 设置页面 |
| `470157f` | feat(mcp): 步骤5 — SettingsPage 集成 |
| `db9c03f` | feat(mcp): 步骤6 — i18n |

## 结论

迭代十五代码实现完成，编译验证通过。MCP 工具链路已打通：

1. 前端 MCP types 完善 ✅
2. mcp-tools.ts 实现 registerMcpTools/unregisterMcpTools ✅
3. dynamic-tool-catalog 接入 MCP 刷新 ✅
4. McpPanel 设置页面（3 文件拆分） ✅
5. SettingsPage 集成 MCP 菜单和渲染 ✅
6. i18n zh/en 翻译 ✅

待用户启动应用进行运行时 E2E 验证。
