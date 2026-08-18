# Plan: v2-iter-16 — 左侧面板整理 + use_capability 工具发现增强

## 目标

发布正式版前整理左侧面板：实现消息搜索功能、重组扩展菜单、修复 use_capability 工具发现的分页/过滤能力、修复辅助窗口导致 reverse-request 发错窗口的 bug、工具输出截断改为 UTF-8 字节级。

## 背景

v2 功能基本开发完毕，Obsidian 知识库 `正式版发布规划.md` 明确了左侧面板整理方向。上次会话已完成大部分后端工作，前端搜索结果渲染未完成，TypeScript 有 14 个编译错误。

## 当前状态（上次会话遗留）

### 已完成（C# 编译通过 ✅）

| 模块 | 状态 | 说明 |
|------|------|------|
| 主窗口注册修复 | ✅ 完成 | `main-window-registry.ts` + `native-agent-runtime.ts` 改用 `getMainWindow()` |
| use_capability 工具发现增强 | ✅ 完成 | `AgentRuntimeUseCapabilityDiscovery.cs` 分页/过滤/搜索 + `ToolRegistry.IsAvailableInMode` |
| 工具输出 UTF-8 字节截断 | ✅ 完成 | `ToolCallProcessor.cs` 32KB 字节级 + Rune 边界安全 + use_capability list/inspect 免截断 |
| DB 搜索端点 | ✅ 完成 | `DbMessageTools.SearchContent` + `MessageSearchResultRow` + JSON 上下文 |
| 扩展功能重组（后端） | ✅ 完成 | `ui-store` 新增 taskBoardPageOpen + `MainLayout` 新增 taskboard placeholder |
| 回归测试适配 | ✅ 完成 | `Program.Lifecycle.cs` + `Program.Support.cs` |

### 未完成（TypeScript 14 个错误 ❌）

| 问题 | 文件 | 说明 |
|------|------|------|
| 搜索结果未渲染 | `WorkspaceSidebar.tsx` | `SidebarSearchResults` 已 import 但未在 JSX 中使用；`result`/`searching` 已解构但未使用 |
| 未使用 import | `WorkspaceSidebar.tsx` | `FolderTree`/`Sparkles`/`Ghost`/`RefreshCw`/`PenTool`/`GitBranch` 旧扩展项 import 残留 |
| 未使用变量 | `WorkspaceSidebar.tsx` | `openCommandPalette` 旧搜索按钮逻辑残留 |
| 未使用 import | `sidebar-search-results.tsx` | `query` 参数已声明但未使用 |
| 未使用 import | `use-sidebar-search.ts` | `useChatStore`/`Project` 已 import 但未使用 |
| 未使用 import | `MainLayout.tsx` | `CheckSquare`/`Image` 旧 import 残留 |

## 步骤清单

### 步骤 1：修复 WorkspaceSidebar — 搜索结果渲染 + 清理旧 import

**任务**：
- 清理旧扩展项 import（`FolderTree`/`Sparkles`/`Ghost`/`RefreshCw`/`PenTool`/`GitBranch`）
- 移除 `openCommandPalette` 旧搜索按钮逻辑
- 在会话列表区域上方渲染 `SidebarSearchResults` 组件，传入 `result.messageHits`/`searching`/`search`
- 搜索有内容时隐藏正常项目/会话列表，只显示搜索结果
- 搜索为空时恢复正常列表

**验证检查点**：`npx tsc --noEmit -p tsconfig.web.json` 关于 WorkspaceSidebar 的错误全部消除

### 步骤 2：修复 sidebar-search-results.tsx — 清理未使用参数

**任务**：
- 移除 `query` 参数（或使用它做高亮）

**验证检查点**：该文件无 TS 错误

### 步骤 3：修复 use-sidebar-search.ts — 清理未使用 import

**任务**：
- 移除 `useChatStore` import（未使用）
- 移除 `Project` type import（未使用）

**验证检查点**：该文件无 TS 错误

### 步骤 4：修复 MainLayout.tsx — 清理旧 import

**任务**：
- 移除 `CheckSquare` import（已被 `CalendarDays` 替代）
- 移除 `Image` import（未使用，FEATURE_PAGES 中用的是 `PenTool`）

**验证检查点**：该文件无 TS 错误

### 步骤 5：全量编译验证

**任务**：
- `npx tsc --noEmit -p tsconfig.web.json` — 零错误
- `npx tsc --noEmit -p tsconfig.node.json` — 零错误
- `npx tsc --noEmit -p tsconfig.json` — 零错误
- `dotnet build src/runtime/WishfulClaw.sln` — 零错误

**验证检查点**：四个编译命令全部零错误

### 步骤 6：功能验证

**任务**：
- 左侧面板搜索输入关键词 → 搜索结果显示匹配的消息（含 snippet）
- 点击搜索结果跳转到对应会话
- 扩展下拉菜单显示绘图/自动化/任务面板三项
- 搜索清空后恢复正常项目/会话列表

**验证检查点**：用户人工验证通过

## 涉及文件

### 已完成（上次会话，不需要修改）

- `src/main/main-window-registry.ts` — 新建，主窗口注册
- `src/main/index.ts` — 注册 mainWindow
- `src/main/ipc/native-agent-runtime.ts` — 改用 getMainWindow()
- `src/runtime/WishfulClaw.Agent/AgentRuntimeUseCapabilityDiscovery.cs` — 新建，工具发现逻辑
- `src/runtime/WishfulClaw.Agent/AgentRuntimeUseCapabilityEncoding.cs` — 精简
- `src/runtime/WishfulClaw.Agent/AgentRuntimeUseCapabilityExecutor.cs` — 适配
- `src/runtime/WishfulClaw.Agent/Tools/Providers/UseCapabilityToolProvider.cs` — 增强描述
- `src/runtime/WishfulClaw.Core/Tools/ToolRegistry.cs` — 新增 IsAvailableInMode
- `src/runtime/WishfulClaw.Agent/ToolCallProcessor.cs` — UTF-8 字节截断
- `src/runtime/WishfulClaw.Infrastructure/Db/DbMessageTools.cs` — 搜索方法
- `src/runtime/WishfulClaw.Infrastructure/Db/DbModule.cs` — 注册端点
- `src/runtime/WishfulClaw.Infrastructure/Db/InfrastructureJsonContext.cs` — JSON 上下文
- `src/runtime/WishfulClaw.Infrastructure/Db/Entities/MessageSearchResultRow.cs` — 新建
- `tests/WishfulClaw.GoalRegressionTests/Program.Lifecycle.cs` — 测试适配
- `tests/WishfulClaw.GoalRegressionTests/Program.Support.cs` — 测试适配
- `src/renderer/src/stores/ui-store-interface.ts` — taskBoardPageOpen
- `src/renderer/src/stores/ui-store.ts` — taskBoardPageOpen
- `src/renderer/src/components/layout/MainLayout.tsx` — taskboard placeholder（需清理 import）
- `src/renderer/src/lib/ipc/renderer-tool-bridge.ts` — 小改
- `src/renderer/src/lib/tools/mcp-capability-bridge.ts` — 小改

### 本次需要修改

- `src/renderer/src/components/layout/WorkspaceSidebar.tsx` — 搜索结果渲染 + 清理旧 import
- `src/renderer/src/components/layout/sidebar-search-results.tsx` — 清理未使用参数
- `src/renderer/src/components/layout/use-sidebar-search.ts` — 清理未使用 import
- `src/renderer/src/components/layout/MainLayout.tsx` — 清理旧 import
- `docs/iteration-plan.md` — 已更新（v2-iter-15 补充模型管理页面，v2-iter-16 改为左侧面板整理，原 Goal 可视化推后到 v2-iter-19）
- `docs/PROGRESS.md` — 完成后更新

## 参考源码

- OpenCowork: `D:\claw\OpenCowork\src\renderer\src\components\layout\WorkspaceSidebar.tsx` — 搜索 UI 参考
- Obsidian: `D:\koda\Obsidian\02-AI教学\wishfulclaw\正式版发布规划.md` — 整理方向
