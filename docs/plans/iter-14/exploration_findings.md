# 迭代十四探索发现：Skill 市场

## 当前项目状态

- 分支：`dev/iter-14`（从 main `d6fda42` 切出，含迭代十二全部成果）
- 迭代十二已合并 main，tag v0.12.0
- 工作区有一个未提交改动：`docs/new-session-prompt.md`（会话提示词，不影响功能）

## 已有基础设施盘点

### 前端（Renderer）

| 文件 | 状态 | 说明 |
|------|------|------|
| `src/renderer/src/stores/skills-store.ts` | **完整** | CRUD + 市场列表 + 下载/扫描/安装流程 + AI 安全审查。调用 IPC: `skills:list/read/delete/save/list-files/add-from-folder/scan/market-list/download-remote/cleanup-temp` |
| `src/renderer/src/components/chat/SkillsMenu.tsx` | **完整** | 聊天输入框 `+` 按钮下拉菜单，包含 Skills 子菜单入口 |
| `src/renderer/src/lib/tools/skill-tool.ts` | **完整** | 从 IPC 加载 skill 列表注册到 `toolRegistry`，构建 Skill 工具描述（含已安装 skill 列表） |
| `src/renderer/src/lib/tools/dynamic-tool-catalog.ts` | **完整** | `refreshDynamicToolCatalog()` 调用 `refreshSkillTools()` + `refreshSubAgentTools()` + `refreshExtensionTools()` |
| `src/renderer/src/lib/agent/skill-reviewer.ts` | **完整** | AI 安全审查 — 用 `streamSidecarProviderTurn` 做 LLM 分析，返回结构化 RiskItem[] |
| `src/renderer/src/lib/ipc/channels.ts` | **完整** | 定义了全部 SKILLS_* 和 MCP_* IPC channel 常量 |
| `src/renderer/src/hooks/use-chat-actions.ts` | **完整** | `ensureRequestToolCatalogFresh()` 在 sendMessage 前刷新工具目录（含 skills） |

### Main 进程

| 文件 | 状态 | 说明 |
|------|------|------|
| `src/main/index.ts` | **stub** | `skills:list` 返回空数组 `[]`；`agents:list`/`commands:list`/`prompts:list` 也是 stub |
| MCP 相关 (`mcp-handlers.ts`/`mcp-manager.ts`/`mcp-client.ts`) | **完整** | MCP 全链路已实现（迭代十五用） |

### 后端（Worker）

| 文件 | 状态 | 说明 |
|------|------|------|
| `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentRuntimeSkillExecutor.cs` | **完整** | 读取 `~/.agents/skills/{name}/SKILL.md`，剥离 frontmatter，返回内容给 Agent |
| `src/runtime/WishfulClaw.Worker/Tools/Providers/SkillToolProvider.cs` | **完整** | 注册 Skill 工具定义到 ToolRegistry |
| `src/runtime/WishfulClaw.Worker/WorkerModuleCatalog.cs` | **缺 SkillModule** | 模块列表中没有 SkillModule |
| SkillModule + SkillCatalog | **不存在** | 需要从 OpenCowork 搬入 |

### 前端设置页面

| 文件 | 状态 | 说明 |
|------|------|------|
| `src/renderer/src/components/settings/SettingsPage.tsx` | **缺 Skills tab** | 设置页面菜单没有 Skills 入口（有 provider/general/persona/ssh/websearch/channel/about） |
| `src/renderer/src/stores/ui-types.ts` | **无 'skills' tab** | SettingsTab 类型没有 `'skills'` 值 |

## 参考源码分析

### OpenCowork SkillModule + SkillCatalog

- 路径：`D:\claw\OpenCowork\sidecars\OpenCowork.Native.Worker\Modules\Skills\`
- `SkillModule.cs`（14行）— IWorkerModule 注册 14 个方法
- `SkillCatalog.cs`（**1109 行，超 500 行上限，必须拆分**）

#### SkillCatalog 的 14 个公开方法

| 方法 | 功能 | 预估行数 |
|------|------|----------|
| `EnsureBuiltins` | 初始化内置 skills | ~40 |
| `EnsureBuiltin` | 安装单个内置 skill | ~50 |
| `List` | 列出已安装 skills | ~50 |
| `Load` | 加载 skill 内容（剥 frontmatter） | ~30 |
| `Read` | 读取原始 SKILL.md | ~25 |
| `ListFiles` | 列出 skill 目录文件 | ~30 |
| `Delete` | 删除 skill | ~25 |
| `ResolvePath` | 解析 skill 路径 | ~25 |
| `AddFromFolder` | 从文件夹安装 skill | ~45 |
| `Save` | 保存 SKILL.md 内容 | ~25 |
| `Scan` | 安全扫描 skill 目录 | ~100 |
| `MarketListAsync` | 市场列表 API | ~60 |
| `DownloadRemoteAsync` | 下载远程 skill | ~100 |
| `CleanupTemp` | 清理临时文件 | ~20 |
| 私有辅助方法 | 路径解析/拷贝/扫描/HTTP | ~500 |

#### 拆分方案

按职责拆为 3 个文件：
1. **`SkillCatalog.cs`**（~200行）— List/Load/Read/ListFiles/Delete/ResolvePath/Save/EnsureBuiltin(s) — 核心 CRUD
2. **`SkillScanEngine.cs`**（~250行）— Scan/AddFromFolder/CleanupTemp + 私有扫描/风险评估方法
3. **`SkillMarketClient.cs`**（~250行）— MarketListAsync/DownloadRemoteAsync + HTTP 辅助方法

#### 关键适配点

1. **命名空间**：`OpenCowork.Native.Worker` → `WishfulClaw.Worker`
2. **Skills 目录**：OpenCowork 用 `~/.open-cowork/skills/`，wishful-claw 的 `AgentRuntimeSkillExecutor.cs` 已用 `~/.agents/skills/` — SkillCatalog 需要统一为 `~/.agents/skills/`
3. **市场 API**：OpenCowork 用 `https://skills.open-cowork.shop` — 需要改为 wishful-claw 的市场地址（或先保留原 URL，后续替换）
4. **依赖类**：`WorkerResponse`/`WorkerLog`/`JsonHelpers`/`WorkerHttpClientFactory` 在 wishful-claw 中已有对应（命名空间 `WishfulClaw.Core.Protocol` / `WishfulClaw.Worker.Runtime`）
5. **WorkerResponse 适配**：OpenCowork 的 `ToResponse(JsonNode)` 需确认 wishful-claw 的 `WorkerResponse` 是否有等价 API

### OpenCowork 前端 Skill 页面

| 文件 | 行数 | 说明 |
|------|------|------|
| `SkillsMarketPanel.tsx` | 140 | 设置页中的市场面板入口 |
| `SkillsPage.tsx` | 674 | 完整的 Skill 管理页面（列表/编辑/市场/安装对话框） |
| `SkillInstallDialog.tsx` | 289 | 安装确认对话框（扫描结果 + AI 审查） |

wishful-claw 的 `skills-store.ts` 已经完整实现了这些功能所需的状态管理，只需要：
1. 创建 `SkillPanel.tsx` 设置面板组件（从 SkillsPage.tsx 精简搬入）
2. 在 `SettingsPage.tsx` 中添加 Skills tab
3. 在 `ui-types.ts` 中添加 `'skills'` SettingsTab

## 潜在风险

1. **WorkerResponse API 差异**：OpenCowork 的 `ToResponse()` 方法在 wishful-claw 中可能名称不同，需要核对适配
2. **Skills 目录不一致**：`AgentRuntimeSkillExecutor.cs` 用 `~/.agents/skills/`，但 OpenCowork SkillCatalog 用 `~/.open-cowork/skills/`，搬入时必须统一
3. **市场 API 可用性**：`skills.open-cowork.shop` 是否可访问需验证，不可访问时市场功能会 fail（但不阻塞本地 skill 管理）
4. **Bundled skills**：OpenCowork 有打包内置 skills（`resources/skills/`），wishful-claw 目前没有 — `EnsureBuiltins` 需要处理空目录情况
5. **1109 行拆分**：SkillCatalog.cs 是高内聚文件，拆分时需注意私有方法/字段的访问范围调整

## 依赖关系

```
Plan 14-1（后端 SkillModule）
    ↓ 依赖
Plan 14-2（前端 SkillPanel 设置页面）
```

Plan 14-1 是基石 — Main 进程 IPC 从 stub 变成真实实现后，前端的 skills-store 就能直接工作。Plan 14-2 在此基础上添加设置页面 UI。
