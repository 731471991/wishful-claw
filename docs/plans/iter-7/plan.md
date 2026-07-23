# 迭代七：记忆系统

## 目标

记忆用上了，不是黑箱。对话前自动注入相关记忆，Agent 能主动读写记忆，记忆有分层生命周期管理。

验证标准：对话中告诉 Agent "记住我是前端工程师" → 关闭重开 → 新对话中 Agent 知道你是前端工程师（通过主动回忆注入，不是用户重新说）。

## 存储设计

| 层级 | 存储 | 说明 |
|------|------|------|
| 热记忆 | `MEMORY.md` 文件 | Critical + Active 分段，启动加载 |
| 温记忆 | `memory/dormant/*.md` 文件 | 降级但可搜索 |
| 冷记忆 | SQLite `memory_archive` 表 + FTS5 | 归档入库，量大时检索 |

全局和项目级各有文件，DB 用 `scope` 字段区分：

| 来源 | 文件路径 | DB scope |
|------|---------|----------|
| 全局 | `~/.wishful-claw/MEMORY.md` + `~/.wishful-claw/memory/dormant/` | `global` |
| 项目 | `{工作区}/.wishful-claw/MEMORY.md` + `{工作区}/.wishful-claw/memory/dormant/` | `project:{projectId}` |

FTS 索引覆盖热记忆 + 温记忆内容，冷记忆直接在 DB 表内建 FTS。搜索优先级：热记忆 → 温记忆 → 冷记忆。

## 记忆工作流

```
用户发消息
  ↓
Agent Loop 开始前
  ↓
MemoryRecallService.TryInjectRecall(userMessage)
  ├── FTS 搜索（先项目级 scope，再全局 scope）
  ├── 命中 → 组装为 User Message，标注 "untrusted reference data"
  └── ContextBudgetPlanner 截断（Token + 字符双限制）
  ↓
注入到 messages[1] 位置（紧随 System Prompt 之后）
  ↓
Agent Loop 运行
  ├── Agent 可调 memory_search 按需搜索更多
  ├── Agent 可调 memory_append 实时写入新记忆
  └── Agent 可调 memory_read / memory_write 操作具体记忆文件
  ↓
Loop 结束
  ↓
（可选）手动触发记忆巩固
```

## 分层架构

| 层 | 项目 | 职责 |
|----|------|------|
| Contracts | WishfulClaw.Contracts | 记忆相关接口和模型定义 |
| Workspace | WishfulClaw.Workspace | 记忆核心实现（Store / Parser / Recall / Budget / Consolidation） |
| Worker | WishfulClaw.Worker | 记忆工具（IToolExecutor）+ MemoryModule（IPC）+ AgentLoop 集成 |
| 前端 | src/renderer | 记忆面板 UI |

## Plan 拆分

共 8 个 Plan，每个 Plan 是一次会话能吃透的工作单元。

---

### Plan 1：Contracts 层 — 接口和模型定义

**目标**：定义记忆系统的所有接口和数据模型，放在 WishfulClaw.Contracts 和 WishfulClaw.Workspace。

**步骤**：
- [ ] 1.1 创建 `WishfulClaw.Workspace/Memory/` 目录，移除 `Class1.cs`
- [ ] 1.2 创建记忆模型：`MemoryEntry`（key/title/priority/status/tags/created/scope/content）、`MemorySearchResult`（key/content/score/updated/scope/tier）、`MemoryStats`（hotCount/warmCount/coldCount）
- [ ] 1.3 创建 `MemoryTier` 枚举（Hot/Warm/Cold）、`MemoryPriority` 枚举（Permanent/Lasting/Standard/Ephemeral）
- [ ] 1.4 创建接口 `IMemoryStore`（Read/Write/List/Promote/Archive）、`IMemorySearch`（SearchAsync）、`IMemoryRecall`（TryInjectRecallAsync）
- [ ] 1.5 dotnet build 通过

**验证**：`dotnet build` 0 错误，模型和接口定义完整

**涉及文件**：
- `WishfulClaw.Workspace/Memory/MemoryModels.cs` — 新建
- `WishfulClaw.Workspace/Memory/IMemoryStore.cs` — 新建
- `WishfulClaw.Workspace/Memory/IMemorySearch.cs` — 新建
- `WishfulClaw.Workspace/Memory/IMemoryRecall.cs` — 新建
- `WishfulClaw.Workspace/Class1.cs` — 删除

**参考源码**：
- KodaClaw: `products/KodaClaw/src/KodaClaw.Contracts/Memory/IMemoryFileService.cs`
- OpenClaw.net: `src/OpenClaw.Core/Abstractions/IMemoryStore.cs`、`src/OpenClaw.Core/Abstractions/IMemoryNoteSearch.cs`

---

### Plan 2：文件层 — MemoryStore + Parser

**目标**：实现 Markdown 文件驱动的记忆读写，包括 MEMORY.md 分段解析和 frontmatter 解析。

**步骤**：
- [ ] 2.1 实现 `MemoryMarkdownParser`：解析 MEMORY.md 的 `## 标题` 分段结构，返回 `(title, body)` 列表。参考 KodaClaw 的 `MemoryMarkdownParser.cs`
- [ ] 2.2 实现 `MemoryFrontmatterParser`：解析 `---` 包裹的 YAML frontmatter（priority/status/tags/created/valid_until）。参考 KodaClaw 的 `MemoryFrontmatterParser.cs`
- [ ] 2.3 实现 `MemoryStore`：文件 CRUD 操作
  - `ReadMemoryAsync(scope)` — 读取 MEMORY.md，返回分段列表
  - `WriteMemoryAsync(scope, sections)` — 写入 MEMORY.md
  - `AppendDailyAsync(scope, content, priority)` — 追加到 `memory/daily/YYYY-MM-DD.md`
  - `ListDormantAsync(scope)` — 列出 dormant/ 下的 .md 文件
  - `ReadDormantAsync(scope, key)` — 读取指定 dormant 文件
  - `WriteDormantAsync(scope, key, content, frontmatter)` — 写入 dormant 文件
  - `PromoteDormantAsync(scope, key)` — 将 dormant 提升回 MEMORY.md active 段
- [ ] 2.4 实现工作区目录初始化：`EnsureMemoryLayout(scope)` — 创建 `memory/daily/`、`memory/dormant/`、`memory/topics/` 目录结构
- [ ] 2.5 实现 scope → 路径解析：全局 `~/.wishful-claw/`，项目 `{workingFolder}/.wishful-claw/`
- [ ] 2.6 dotnet build 通过

**验证**：`dotnet build` 0 错误，手动单元测试：创建临时目录 → 写入 MEMORY.md → 解析分段 → 写入 dormant → promote

**涉及文件**：
- `WishfulClaw.Workspace/Memory/MemoryMarkdownParser.cs` — 新建
- `WishfulClaw.Workspace/Memory/MemoryFrontmatterParser.cs` — 新建
- `WishfulClaw.Workspace/Memory/MemoryStore.cs` — 新建
- `WishfulClaw.Workspace/Memory/MemoryPathResolver.cs` — 新建

**参考源码**：
- KodaClaw: `products/KodaClaw/src/KodaClaw.Workspace/Memory/MemoryFileService.cs`
- KodaClaw: `products/KodaClaw/src/KodaClaw.Workspace/Memory/MemoryMarkdownParser.cs`
- KodaClaw: `products/KodaClaw/src/KodaClaw.Workspace/Memory/MemoryFrontmatterParser.cs`

---

### Plan 3：FTS5 索引层 — SQLite 全文搜索

**目标**：在现有 SQLite 中扩展 FTS5 虚拟表，记忆文件变更时自动同步索引。

**步骤**：
- [ ] 3.1 在 `DbEntities.cs` 中添加 `MemoryArchiveEntity`（id/scope/key/title/content/priority/created/archived_at），对应 `memory_archive` 表
- [ ] 3.2 在 `DbClient.Initialize` 中添加建表逻辑：`memory_archive` 表 + `memory_fts` FTS5 虚拟表（scope/key/title/content）+ 触发器（INSERT/UPDATE/DELETE 自动同步 FTS）
- [ ] 3.3 实现 `MemoryFtsService`：
  - `IndexMemoryAsync(scope, key, title, content)` — 写入/更新 FTS 索引
  - `RemoveFromIndexAsync(scope, key)` — 从 FTS 删除
  - `SearchAsync(query, scope, limit)` — FTS5 搜索，返回带 score 的结果
  - `ArchiveToDbAsync(scope, key, title, content, priority)` — 将 dormant 文件归档到 `memory_archive` 表
  - `SearchArchiveAsync(query, scope, limit)` — 搜索冷记忆
- [ ] 3.4 实现 FTS 索引同步：MemoryStore 写入/删除记忆时，自动调用 MemoryFtsService 更新索引
- [ ] 3.5 dotnet build 通过

**验证**：`dotnet build` 0 错误，端到端测试：写入一条记忆 → FTS 搜索命中 → 删除 → 搜索无结果

**涉及文件**：
- `WishfulClaw.Worker/Modules/Db/DbEntities.cs` — 修改（加 MemoryArchiveEntity）
- `WishfulClaw.Worker/Modules/Db/DbClient.cs` — 修改（加建表）
- `WishfulClaw.Workspace/Memory/MemoryFtsService.cs` — 新建

**参考源码**：
- OpenClaw.net: `src/OpenClaw.Core/Memory/SqliteMemoryStore.cs`（FTS5 虚拟表 + 触发器）
- OpenClaw.net: `src/OpenClaw.Core/Abstractions/IMemoryNoteSearch.cs`

---

### Plan 4：记忆工具 — Agent 可调用的 4 个工具

**目标**：实现 `memory_append` / `memory_search` / `memory_read` / `memory_write` 四个 IToolExecutor 工具，注册到 ToolModule。

**步骤**：
- [ ] 4.1 实现 `MemoryAppendTool`：写入今日 daily 日志，参数 `content`（必填）/ `priority`（默认 standard）/ `scope`（默认当前项目，fallback 全局）。参考 KodaClaw `WorkspaceMemoryAppendTool`
- [ ] 4.2 实现 `MemorySearchTool`：FTS5 搜索记忆，参数 `query`（必填）/ `scope`（可选）/ `limit`（默认 10）。参考 OpenClaw.net `MemorySearchTool`
- [ ] 4.3 实现 `MemoryReadTool`：读取 MEMORY.md 或指定 dormant 文件，参数 `target`（memory/dormant/topics）/ `scope`（可选）
- [ ] 4.4 实现 `MemoryWriteTool`：写入/更新 MEMORY.md 中的指定分段，参数 `section`（标题）/ `content`（内容）/ `scope`（可选）
- [ ] 4.5 在 `ToolModule.Register` 中注册 4 个记忆工具
- [ ] 4.6 在 `ToolExecutionContext` 中添加 `ProjectId` 字段（工具需要知道当前项目 scope）
- [ ] 4.7 dotnet build 通过

**验证**：`dotnet build` 0 错误，`tool/list` IPC 返回的工具有 memory_append/memory_search/memory_read/memory_write

**涉及文件**：
- `WishfulClaw.Worker/Tools/MemoryTools/MemoryAppendTool.cs` — 新建
- `WishfulClaw.Worker/Tools/MemoryTools/MemorySearchTool.cs` — 新建
- `WishfulClaw.Worker/Tools/MemoryTools/MemoryReadTool.cs` — 新建
- `WishfulClaw.Worker/Tools/MemoryTools/MemoryWriteTool.cs` — 新建
- `WishfulClaw.Worker/Tools/ToolModule.cs` — 修改（注册记忆工具）
- `WishfulClaw.Core/Tools/ToolTypes.cs` — 修改（ToolExecutionContext 加 ProjectId）

**参考源码**：
- KodaClaw: `products/KodaClaw/src/KodaClaw.Runtime/Tools/WorkspaceMemoryAppendTool.cs`
- OpenClaw.net: `src/OpenClaw.Agent/Tools/MemorySearchTool.cs`、`src/OpenClaw.Agent/Tools/MemoryNoteTool.cs`

---

### Plan 5：TryInjectRecall — 记忆自动注入

**目标**：Agent Loop 开始前自动搜索相关记忆，注入到对话上下文。包含上下文预算控制。

**步骤**：
- [ ] 5.1 实现 `MemoryRecallService`：
  - `TryInjectRecallAsync(userMessage, scope, conversation)` — 搜索记忆并组装注入文本
  - 先搜项目级 scope，无结果再搜全局 scope
  - 搜索范围：FTS 索引（热+温）+ 冷记忆 DB 表
  - 命中结果组装为 `[Relevant memory]` 格式，标注 "untrusted reference data"
- [ ] 5.2 实现 `ContextBudgetPlanner`：
  - `Plan(contextTokens, maxChars, maxTokens)` — 计算记忆注入的最大字符数
  - Token × 4 估算字符数，取 Token 限制和字符限制的最小值
  - 参考 OpenClaw.net `ContextBudgetPlanner`
- [ ] 5.3 在 `AgentLoop.ExecuteLoopAsync` 中取消注释 `TryInjectRecallAsync` placeholder，改为实际调用
- [ ] 5.4 注入位置：messages.Insert(1, ...)（紧随 System Prompt 之后）
- [ ] 5.5 注入失败不阻塞：catch 异常，log warning，继续执行 Loop
- [ ] 5.6 dotnet build 通过

**验证**：`dotnet build` 0 错误，运行时测试：对话前日志显示记忆注入命中/未命中

**涉及文件**：
- `WishfulClaw.Workspace/Memory/MemoryRecallService.cs` — 新建
- `WishfulClaw.Workspace/Memory/ContextBudgetPlanner.cs` — 新建
- `WishfulClaw.Worker/AgentRuntime/AgentLoop.cs` — 修改（集成 TryInjectRecall）
- `WishfulClaw.Worker/AgentRuntime/AgentRuntimeTools.cs` — 可能修改（传递 scope/projectId 参数）

**参考源码**：
- OpenClaw.net: `src/OpenClaw.Agent/AgentRuntime.cs` 的 `TryInjectRecallAsync` 方法（第 987-1055 行）
- OpenClaw.net: `src/OpenClaw.Core/Memory/ContextBudgetPlanner.cs`

---

### Plan 6：System Prompt 集成 — MEMORY.md Critical 段注入

**目标**：PromptBuilder 在构建 System Prompt 时，加载 MEMORY.md 的 Critical 段摘要（非全量），控制 System Prompt 体积。

**步骤**：
- [ ] 6.1 在 `PromptBuilder.Build` 中添加记忆段加载逻辑：读取 MEMORY.md（先项目级再全局），提取 Critical 段
- [ ] 6.2 新增 `BuildMemoryContext` 方法：将 Critical 段组装为 `<memory>` 块，标注 "untrusted reference data"
- [ ] 6.3 字符预算：记忆段占用不超过总预算的 30%（约 6000 字符），超限截断
- [ ] 6.4 注入位置：在 persona context documents 之后、tool capability 之前
- [ ] 6.5 dotnet build 通过

**验证**：`dotnet build` 0 错误，运行时日志显示 System Prompt 中包含记忆段

**涉及文件**：
- `WishfulClaw.Worker/Persona/PromptBuilder.cs` — 修改

**参考源码**：
- KodaClaw: `products/KodaClaw/src/KodaClaw.Gateway/skills/koda-memory/SKILL.md`（MEMORY.md 分层索引规则）
- 项目文档: `docs/data-storage.md`（记忆读取流程）

---

### Plan 7：MemoryModule — IPC 端点

**目标**：前端可通过 IPC 操作记忆系统（列表/搜索/读取/写入/归档/巩固）。

**步骤**：
- [ ] 7.1 创建 `MemoryModule : IWorkerModule`，注册到 `WorkerModuleCatalog`
- [ ] 7.2 注册 IPC 端点：
  - `memory/stats` — 返回记忆统计（hot/warm/cold count）
  - `memory/list` — 列出记忆条目（支持 scope/tier/status 过滤）
  - `memory/search` — 搜索记忆（FTS）
  - `memory/read` — 读取指定记忆
  - `memory/write` — 写入/更新记忆
  - `memory/append` — 追加 daily 日志
  - `memory/promote` — 提升 dormant 到 active
  - `memory/archive` — 归档 dormant 到 DB
  - `memory/consolidate` — 触发记忆巩固
- [ ] 7.3 前端 db-helpers.ts 或新建 memory-helpers.ts：封装 IPC 调用
- [ ] 7.4 dotnet build + tsc 通过

**验证**：`dotnet build` + `tsc` 0 错误，IPC 调用 memory/stats 返回正确统计

**涉及文件**：
- `WishfulClaw.Worker/Modules/MemoryModule.cs` — 新建
- `WishfulClaw.Worker/WorkerModuleCatalog.cs` — 修改（注册 MemoryModule）
- `src/renderer/src/stores/chat-store/memory-helpers.ts` — 新建
- `src/main/ipc/` — 可能需要添加 memory-handlers.ts

**参考源码**：
- 项目现有: `WishfulClaw.Worker/Modules/Db/DbModule.cs`（IPC 注册模式）
- 项目现有: `WishfulClaw.Worker/Modules/ProviderModule.cs`（Module 注册模式）

---

### Plan 8：前端记忆面板 + 端到端验证

**目标**：前端可视化记忆文件和状态，完成端到端验证闭环。

**步骤**：
- [ ] 8.1 创建记忆面板组件 `MemoryPanel.tsx`：
  - 统计卡片（热/温/冷记忆数量）
  - 记忆列表（可按 scope/tier 过滤）
  - 搜索框（调用 memory/search IPC）
  - 记忆详情查看（点击展开内容）
- [ ] 8.2 在 WorkspaceSidebar 或 RightPanel 中添加记忆面板入口
- [ ] 8.3 i18n 添加记忆相关文案（中英文）
- [ ] 8.4 tsc + electron-vite build + dotnet build 全部通过
- [ ] 8.5 端到端验证：
  - 对话中让 Agent 记住一条信息（通过 memory_append 工具）
  - 关闭应用重开
  - 新对话中 Agent 通过 TryInjectRecall 自动知道该信息
  - 记忆面板显示该条记忆
- [ ] 8.6 更新 `docs/PROGRESS.md`

**验证**：tsc + build + dotnet 全部通过 + 端到端测试通过

**涉及文件**：
- `src/renderer/src/components/memory/MemoryPanel.tsx` — 新建
- `src/renderer/src/components/memory/MemoryList.tsx` — 新建
- `src/renderer/src/components/memory/MemorySearchBar.tsx` — 新建
- `src/renderer/src/stores/memory-store.ts` — 新建
- `src/renderer/src/locales/` — 修改（加记忆相关 i18n）

**参考源码**：
- 项目现有: `src/renderer/src/components/`（组件风格参考）
- OpenCowork 前端布局（面板嵌入方式）

---

## Plan 依赖关系

```
Plan 1（Contracts 接口）
  ↓
Plan 2（文件层 Store + Parser）
  ↓
Plan 3（FTS5 索引层）        ← 依赖 Plan 2（MemoryStore 写入时同步索引）
  ↓
Plan 4（记忆工具）            ← 依赖 Plan 2 + Plan 3
  ↓
Plan 5（TryInjectRecall）     ← 依赖 Plan 3（FTS 搜索）+ Plan 4（工具注册后 scope 可用）
  ↓
Plan 6（System Prompt 集成）  ← 依赖 Plan 2（读取 MEMORY.md）
  ↓
Plan 7（MemoryModule IPC）    ← 依赖 Plan 2 + Plan 3
  ↓
Plan 8（前端面板 + 端到端）   ← 依赖 Plan 7（IPC）+ Plan 5（注入）+ Plan 6（System Prompt）

Plan 6 和 Plan 7 可以并行（不互相依赖）。
```

## 参考源码位置（本机）

| 项目 | 路径 |
|------|------|
| OpenCowork | `F:\claw\OpenCowork` |
| KodaClaw | `F:\claw\koda-claw` |
| OpenClaw.net | `F:\claw\openclaw.net` |

## 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 热温记忆存储 | Markdown 文件 | 人可读、可编辑、量少时文件够用 |
| 冷记忆存储 | SQLite `memory_archive` 表 | 量大时文件管理成本高，入库 + FTS 检索 |
| 注入方式 | User Message（非 System Prompt） | 防 prompt injection，参考 OpenClaw.net |
| 搜索方案 | SQLite FTS5 | 效率高，触发器自动同步 |
| 降级机制 | 第一版手动触发 + 时间阈值 | Nightly 六阶段太复杂，先跑通核心 |
| System Prompt | 只放 MEMORY.md Critical 段摘要 | 避免全量塞入挤占上下文 |
| 优先级 | permanent / lasting / standard / ephemeral | 直接用 KodaClaw 的体系 |
| scope | global / project:{projectId} | 统一 DB 表区分来源 |

## 避坑清单

| 避坑 | 来源 |
|------|------|
| 不做 Nightly 六阶段自动整合 | KodaClaw 太复杂，第一版手动触发巩固 |
| 不用 fs_grep 搜索记忆文件 | KodaClaw 效率低，用 FTS5 |
| 不全量塞 MEMORY.md 到 System Prompt | KodaClaw 记忆多了挤占上下文，只放 Critical 段 |
| 不用扁平 key-value 存记忆 | OpenClaw.net Notes 没层级，用 Markdown 分段 |
| 注入文本标注 "untrusted" | OpenClaw.net 防 prompt injection |
| 不做向量搜索 | OpenClaw.net 有 embedding 但依赖外部服务，第一版 FTS 够用 |
