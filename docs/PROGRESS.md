# 开发进度

## 迭代一：项目骨架
- 状态：已完成
- 分支：dev/iter-1
- Plan: docs/plans/plan_001/
- VERDICT: PASS
- Tag: v0.1.0
- Commit: (待 commit)
- 日期: 2026-07-20
- 备注：全链路验证通过。Electron + .NET 工程跑起来，前端发 ping，后端回 pong（ok=true, pid=<worker_pid>）。

## 迭代二：AI 服务商 + 模型管理
- 状态：已完成
- 分支：dev/iter-2
- Plan: docs/plans/plan_002/
- VERDICT: PASS
- Tag: v0.2.0
- Commit: c4f5b10
- 日期: 2026-07-21
- 备注：28 个内置预设完整对齐 OpenCowork（含 OAuth/Channel），Provider CRUD + 连通性测试 + 模型拉取，前端设置页面（Provider/通用/i18n），验证通过

## 迭代三：Agent Loop + 对话
- 状态：已完成（含前端修复）
- 分支：dev/iter-3
- Plan: docs/plans/plan_003/ + docs/plans/plan_003b/
- VERDICT: PASS (plan_003 + plan_003b)
- Tag: v0.3.0 (plan_003) / v0.3.1 (plan_003b 待打)
- Commit: d5f0245 (plan_003) / adeae4d (plan_003b)
- 日期: 2026-07-21
- 备注：
  - plan_003: Agent Loop 后端 + 前端流式对话（v0.3.0 已验证通过）
  - plan_003b: 前端框架修复 — 搬入 OpenCowork 完整布局（NavRail+WorkspaceSidebar+TitleBar+CommandPalette+RightPanel+SessionConversationPane+ChatHomePage+ProjectHomePage），保留所有功能入口+接口预留，chat-store 拆分7文件+immer中间件。tsc+electron-vite build+dotnet build 全部通过。

## 迭代四：工具链（最小集）
- 状态：已完成
- 分支：dev/iter-4（已合并 main）
- Plan: docs/plans/iter-4/plan-001/ + docs/plans/iter-4/plan-002/
- VERDICT: PASS
- Tag: v0.4.0
- Commit: 867b890 (plan-001) / 03bf2e2 (plan-002)
- 日期: 2026-07-22
- 备注：
  - plan-001: 后端工具框架 — IToolExecutor 接口 + ToolRegistry + 7个工具实现（Read/Write/Edit/LS/Glob/Grep/Bash）+ ToolModule 注册 + tool/list IPC handler。dotnet build 0错误。
  - plan-002: AgentLoop 工具执行集成 + 前端工具 UI — 替换占位代码实现完整工具调用循环，前端 ToolCallCard 组件 + 事件处理 + sendMessage 传入 tools/workingFolder。tsc+build+dotnet 全部通过。

## 迭代五：项目注册 + 会话历史
- 状态：进行中（plan-001 + plan-002 代码完成，待用户端到端验证）
- 分支：dev/iter-5
- Plan: docs/plans/iter-5/plan-001/ + docs/plans/iter-5/plan-002/
- VERDICT: PASS (编译验证 + 端到端 DB 测试) / 待用户端到端验证
- Tag: —（待验证后打 v0.5.0）
- Commit: 48e6aec (plan-001) / 45104f1 (plan-002)
- 日期: 2026-07-22
- 备注：
  - plan-001: 后端 DB 层 — SqlSugarCore ORM + DbClient/DbEntities/DbProjectTools/DbSessionTools/DbMessageTools/DbModule，CodeFirst 自动建表，8 项端到端测试通过
  - plan-002: 前端 DB 层 — db-helpers.ts 用 workerRequest 直连 Worker（简化架构，无需 Main 侧 DAO），消息序列化/反序列化，sendMessage/message_end 实时持久化，dbLoadAll 启动加载，loadRecentSessionMessages 按需加载
  - 架构简化：原计划 5 个 Main 侧文件 → 0 个（worker:request 通用转发器已覆盖）
  - tsc + electron-vite build + dotnet build 全部通过

## 迭代六：人格系统
- 状态：代码完成（8 个 Plan 全部完成，待运行时端到端验证）
- 分支：dev/iter-6
- Plan: docs/plans/iter-6/plan-001 ~ plan-008
- VERDICT: PASS (编译验证 tsc + electron-vite build + dotnet build 全部通过) / 待运行时验证
- Tag: —（待验证后打 v0.6.0）
- Commit: 1a8289f ~ a9804bf
- 日期: 2026-07-23
- 备注：
  - plan-001: 后端人格数据层 — PersonaModels + PersonaStore + 6 套 24 个 .md 预设 + csproj 嵌入资源
  - plan-002: PersonaModule IPC 端点 — list/get/save/delete/apply-to-project
  - plan-003: 前端人格管理 UI（全局）— persona-types + persona-store + PersonaPanel(拆 3 文件) + SettingsPage 集成 + i18n
  - plan-004: 项目级人格管理 UI — PersonaPanel 支持 workingFolder + ChatView persona + MainLayout + ProjectHomePage 按钮
  - plan-005: SplashPage 改造 — PersonaSelectPage + onboarding 流程 + settings-store 加 defaultPersonaId
  - plan-006: PromptBuilder + AgentLoop 集成 — 分段组装 System Prompt + 字符预算截断 + InjectSystemPrompt
  - plan-007: AI 辅助创建人格 — PersonaGenerator（单轮 LLM 调用）+ persona/generate 端点 + PersonaGeneratorDialog
  - plan-008: 会话级人格切换 + DB 变更 — SessionEntity 加 PersonaId + ALTER TABLE 迁移 + PersonaSwitcher 组件
  - PersonaStore 耦合拆分：PersonaStore(文件 CRUD) + PersonaPresetService(预设加载)
## 迭代七：记忆系统
- 状态：代码完成（8 个 Plan 全部完成，待运行时端到端验证）
- 分支：dev/iter-7
- Plan: docs/plans/iter-7/plan.md (Plan 1~8)
- VERDICT: PASS (编译验证 tsc + dotnet build 全部通过) / 待运行时验证
- Tag: —（待验证后打 v0.7.0）
- Commit: c8b481b ~ aac4ba0
- 日期: 2026-07-23
- 备注：
  - Plan 1: 接口和模型定义 — MemoryModels (MemoryEntry/MemoryTier/MemoryPriority/MemorySearchResult/MemoryStats/MemoryFrontmatter/MemorySection) + IMemoryStore + IMemorySearch + IMemoryRecall
  - Plan 2: 文件层 — MemoryMarkdownParser (## 分段解析+UpsertSection) + MemoryFrontmatterParser (YAML frontmatter) + MemoryPathResolver (scope→路径) + MemoryStore (MEMORY.md/daily/dormant CRUD)
  - Plan 3: FTS5 索引层 — MemoryArchiveEntity + memory_fts FTS5 虚拟表 + 触发器自动同步 + MemoryFtsService (Search/Index/Archive/SearchCold)
  - Plan 4: 记忆工具 — memory_append/memory_search/memory_read/memory_write 4 个工具 + ToolModule 注册 + ToolTypes 加 ProjectId
  - Plan 5: TryInjectRecall — ContextBudgetPlanner (Token×4+字符双限制) + MemoryRecallService (先项目后全局+冷记忆fallback) + AgentLoop iteration==1 时注入
  - Plan 6: System Prompt 集成 — PromptBuilder.BuildMemoryContext 注入 MEMORY.md Critical 段 (预算 6000 字符)
  - Plan 7: MemoryModule IPC — 9 个端点 (stats/list/search/read/write/append/promote/archive/consolidate)
  - Plan 8: 前端 — memory-helpers.ts (IPC 封装) + MemoryPanel.tsx (统计卡片+搜索+结果) + RightPanel 双 tab + i18n (中英文)
  - 三层架构：Hot (MEMORY.md 文件) / Warm (dormant/*.md 文件) / Cold (SQLite memory_archive 表 + FTS5)
  - scope 字段区分：global (~/.wishful-claw/) 或 project:{workingFolder} ({工作区}/.wishful-claw/)
  - TryInjectRecall 注入为 User Message，标注 untrusted reference data 防 prompt injection
  - 迭代六已合并到 main，dev/iter-7 已 rebase 到最新 main

## 迭代八：集成验证
- 状态：未开始
- Plan: —
- VERDICT: —
- Tag: —
- Commit: —
- 日期: —
