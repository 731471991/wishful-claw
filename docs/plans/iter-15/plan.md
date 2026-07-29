# Plan: 迭代十五 — MCP 管理

## 目标

打通 MCP 工具链路：前端 MCP 工具注册到 toolRegistry → dynamic-tool-catalog 刷新 → Agent 对话中调用 MCP 工具 → Worker reverse-request 到 Main 执行。同时提供 McpPanel 设置页面管理 MCP Server 配置。

## 步骤清单

- [ ] 步骤1：完善前端 MCP types — 从 OpenCowork 同步 McpTransportType 等类型定义
  - 验证：tsc --noEmit -p tsconfig.web.json 通过
- [ ] 步骤2：实现 mcp-tools.ts — 从 OpenCowork 适配搬入 registerMcpTools/unregisterMcpTools/registerMcpResources
  - 验证：tsc 通过，isMcpTool 正确识别 mcp__ 前缀
- [ ] 步骤3：接入 dynamic-tool-catalog — 添加 refreshMcpTools() 到刷新链路
  - 验证：tsc 通过，refreshDynamicToolCatalog 含 MCP 刷新
- [ ] 步骤4：创建 McpPanel 设置页面 — 从 OpenCowork 适配，拆为 mcp-panel + mcp-server-config + mcp-add-dialog 三个文件
  - 验证：tsc 通过，面板渲染正常
- [ ] 步骤5：SettingsPage 集成 — 添加 MCP 菜单项和渲染分支
  - 验证：tsc 通过，设置页面可切换到 MCP tab
- [ ] 步骤6：i18n — zh/en settings.json 添加 mcp.* 翻译条目
  - 验证：tsc 通过，UI 中英文切换正常

## 涉及文件

### 新建
- `src/renderer/src/components/settings/mcp-panel.tsx` — 主面板（列表 + 配置面板编排）
- `src/renderer/src/components/settings/mcp-server-config.tsx` — 服务器配置面板（名称/传输/命令/URL/连接控制/工具展示）
- `src/renderer/src/components/settings/mcp-add-dialog.tsx` — 添加服务器对话框（手动创建 + JSON 导入）

### 修改
- `src/renderer/src/lib/mcp/types.ts` — 补充 McpTransportType 等类型
- `src/renderer/src/lib/mcp/mcp-tools.ts` — 实现 registerMcpTools/unregisterMcpTools
- `src/renderer/src/lib/tools/dynamic-tool-catalog.ts` — 添加 refreshMcpTools
- `src/renderer/src/components/settings/SettingsPage.tsx` — 添加 MCP 菜单项和渲染
- `src/renderer/src/locales/zh/settings.json` — 添加 mcp.* 翻译
- `src/renderer/src/locales/en/settings.json` — 添加 mcp.* 翻译

## 参考源码

- OpenCowork: `D:\claw\OpenCowork\src\renderer\src\lib\mcp\mcp-tools.ts` — 工具注册逻辑
- OpenCowork: `D:\claw\OpenCowork\src\renderer\src\components\settings\McpPanel.tsx` — UI 参考
- OpenCowork: `D:\claw\OpenCowork\src\renderer\src\lib\mcp\types.ts` — 类型定义
- 已有: `src/main/mcp/mcp-types.ts` — Main 侧类型（对齐参考）
- 已有: `src/main/ipc/mcp-handlers.ts` — IPC handler（已完整）
- 已有: `src/runtime/.../AgentRuntimeMcpExecutor.cs` — Worker 侧执行器（已完整）
