# 开发进度

## v2-iter-11：Native AOT 打包 — SqlSugar → Microsoft.Data.Sqlite 迁移
- 状态：已完成 PASS
- Tag: v2.11.0
- 分支：dev/v2-iter-11
- Commit: 32409a3
- 日期: 2026-08-08
- 备注：将 SqlSugar ORM 完全替换为 Microsoft.Data.Sqlite（零反射，AOT 友好）。
  - 新建 DbService 包装类（Query/QueryFirstOrDefault/QueryScalar/Execute/ExecuteReturnIdentity/Exists/QueryDataTable），替代 SqlSugarScope
  - 新建 EntityMappers（9 个 entity 的显式 mapper 委托，编译时确定，零反射）
  - 新建 DbReaderExtensions（SqliteDataReader null 安全扩展）
  - 重写 DbClient：手写 CREATE TABLE DDL（10 表 + FTS5 虚拟表 + 4 个触发器），替代 CodeFirst
  - 迁移全部 9 个 Db*Tools 文件 + MemoryFtsService + Agent 层 5 个文件 + Worker MemoryModule
  - 移除全部 SugarTable/SugarColumn 属性，Entity 类变为纯 POCO
  - 清除 AOT 逃避配置：删除 rd.xml、移除 StaticConfig.EnableAot、移除 JsonSerializerIsReflectionEnabledByDefault
  - C# 编译：0 错误，10 警告（SQLitePCLRaw 传递依赖漏洞警告）
  - TypeScript 编译：3/3 配置 PASS
  - AOT 打包：成功 — Worker.exe = 14.6 MB（不含 pdb），0 错误，158 个 trim/AOT 分析警告（JsonSerializer 反射警告，后续可用 source generation 消除）
  - C++ 工具链：VS 2026 Build Tools (MSVC 14.44)，位于 C:\Program Files (x86)\Microsoft Visual Studio8\BuildTools，需设置 PATH/INCLUDE/LIB 环境变量（run_aot.sh 脚本）

## v2-iter-10：全局会话 + 项目编排工具
- 状态：已完成
- 分支：main
- VERDICT: PASS
- Tag: v2.10.0
- Commit: 1d3eb2f
- 日期: 2026-08-08
- 备注：全局会话 + 4 个项目编排工具（list_projects/get_project_details/create_session/send_session_message），ToolProvider availableModes 扩展 "global" 模式，sessionMode 类型支持 "global"，send_session_message 通过 reverse request 走 renderer sendMessage 链路，fire-and-forget 异步执行，InputArea 区分全局/项目会话。
  - 审查修正：send_session_message 描述改为 fire-and-forget 语义，清理返回值调试信息，加 .catch() 防止未捕获 rejection
  - ContextCompression 拆分为 partial class（TokenEstimation + Transcript）
  - 相关修复：ProviderRetryPolicy 400 可重试、FileListTool hidden 默认 true、DbMessageTools 更新 UpdatedAt、cancelStream 多会话修复、会话列表流式状态指示器



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
- 状态：已完成
- 分支：dev/iter-5（已合并 main）
- Plan: docs/plans/iter-5/plan-001/ + docs/plans/iter-5/plan-002/
- VERDICT: PASS (编译验证 + 端到端 DB 测试)
- Tag: v0.5.0
- Commit: 48e6aec (plan-001) / 45104f1 (plan-002)
- 日期: 2026-07-22
- 备注：
  - plan-001: 后端 DB 层 — SqlSugarCore ORM + DbClient/DbEntities/DbProjectTools/DbSessionTools/DbMessageTools/DbModule，CodeFirst 自动建表，8 项端到端测试通过
  - plan-002: 前端 DB 层 — db-helpers.ts 用 workerRequest 直连 Worker（简化架构，无需 Main 侧 DAO），消息序列化/反序列化，sendMessage/message_end 实时持久化，dbLoadAll 启动加载，loadRecentSessionMessages 按需加载
  - 架构简化：原计划 5 个 Main 侧文件 → 0 个（worker:request 通用转发器已覆盖）
  - tsc + electron-vite build + dotnet build 全部通过

## 迭代六：人格系统
- 状态：已完成
- 分支：dev/iter-6（已合并 main）
- Plan: docs/plans/iter-6/plan-001 ~ plan-008
- VERDICT: PASS (编译验证 tsc + electron-vite build + dotnet build 全部通过)
- Tag: v0.6.0
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
- 状态：已完成
- 分支：dev/iter-7（已合并 main）
- Plan: docs/plans/iter-7/plan.md (Plan 1~8)
- VERDICT: PASS (编译验证 tsc + dotnet build 全部通过)
- Tag: v0.7.0
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

## 迭代八：集成验证
- 状态：已完成
- 分支：main
- Plan: —
- VERDICT: PASS
- Tag: v0.8.0
- Commit: 32ed2a6
- 日期: 2026-07-23
- 备注：
  - 记忆系统全链路修复（FTS5外部内容表、触发器语法、参数绑定）
  - Worker 进程防崩溃
  - 日志等级控制
  - 记忆工具预览 UI
  - 消息时间戳
  - 历史消息加载修复
  - Agent Loop 迭代限制去除
  - Base Instruction 人格冲突修复（改为运行环境介绍而非身份定义）
  - 代码已合并到 main，旧开发分支已清理

---

## v2 迭代

### v2-iter-2：缓存命中率修复 + LLM 上下文压缩 + 版本号统一
- 状态：已完成
- 分支：dev/v2-iter-2（已合并 main）
- VERDICT: PASS
- Tag: v2.2.0
- Commit: 8b19017
- 日期: 2026-07-2?
- 备注：缓存命中率统计修复、LLM 上下文压缩、版本号统一为 v2.x、OpenCowork 名称清理、7 层架构文档更新

### v2-iter-3：Infrastructure 层拆分 + DeepSeek 缓存命中率深度修复
- 状态：已完成
- 分支：dev/v2-iter-3（已合并 main）
- VERDICT: PASS
- Tag: v2.3.0
- Commit: 318e126
- 日期: 2026-07-2?
- 备注：Infrastructure 层 Db/Storage/Http 下沉、Worker 深度瘦身（Modules 迁入 Agent/Infrastructure，Worker 降至 12 文件）、缓存命中率深度修复

### v2-iter-9：Goal 模式自动编排 + 系统完善
- 状态：已完成
- 分支：dev/v2-iter-9（已合并 main）
- VERDICT: PASS
- Tag: v2.9.0
- Commit: 9f8d861
- 日期: 2026-08-07
- 备注：
  - Goal 模式自动编排 — create_goal 进 pending，前端确认卡片（类似计划模式确认卡片）用户确认后启动 GoalOrchestrator 自动编排执行，goal/confirm IPC 路由
  - GoalOrchestrator 拆分 — GoalOrchestrator / GoalOrchestratorLLM / GoalOrchestratorLoop / GoalOrchestratorModels / GoalPlanTracker / GoalPromptTemplates / GoalBackoffStrategy，goal → plan → execute → verify → continue/adjust 状态机
  - 上下文压缩阈值统一 — 后端阈值基数改用 effectiveWindow（contextLength−预留输出），与前端 getCompressionTriggerTokens 对齐，两端约 80% 一致触发
  - 移除前端压缩死代码 — context-compression-runtime.ts 及 types.ts 中 contextCompression 字段（压缩实际由后端 worker 执行）
  - 内置浏览器修复 — BrowserPanel 改用 callback ref 绑定 webview 事件，修复首次挂载与 key 切换时事件不绑定、导航重绑问题；新增 render-process-gone 崩溃自动恢复
  - main 窗口推送统一用 postMessage — 避免 webContents.send 在 frame 销毁时异步抛 Render frame was disposed；修复 goal:confirm 注册参数错位
  - 工具耗时显示 — file 写入/编辑改为毫秒(ms)级别，与其余工具一致
  - 配色默认值 — 默认配色改远航蓝(studio) 并迁移；AOT 兼容配置（StaticConfig.EnableAot + rd.xml）

### v2-iter-8：计划模式（人机协同执行引擎）
- 状态：已完成
- 分支：dev/v2-iter-8（已合并 main）
- VERDICT: PASS
- Tag: v2.8.0
- Commit: 7e19496
- 日期: 2026-08-05
- 备注：
  - 计划模式状态机 — explore → plan → confirm → execute → verify，Agent 接收需求后走完整人机协同流程
  - 计划文件格式 — .wishful-claw/plans/{planId}.md 计划文件 + {planId}.state.json 状态文件（计划标题、步骤清单、每步状态、执行结果摘要）
  - 状态落盘 — 执行过程中实时更新 state.json，外部可读取“当前在做什么、做到哪了”
  - 用户确认环节 — SubmitPlanReview 通过 reverse request 暂停 agent loop 等待用户确认，确认后才执行；ExitPlanMode 取消计划
  - 前端 PlanReviewCard — 步骤清单 + 实时状态 + 验证结果 + Adjust plan 反馈输入
  - Plan mode banner — session 级隔离（planModesBySession），Exit Plan Mode 按钮处理两种场景：agent 流式中 cancelStream + sendMessage，等待 review 时 cancelPlanReview resolve cancelled
  - 工具拆分 — ExitPlanMode 拆为 SubmitPlanReview（提交审查）+ ExitPlanMode（取消），新增 UpdatePlanStep（步骤状态跟踪）
  - Plan store 从 invokeMessagePackBinary 迁移到 window.api.workerRequest
  - PlanEntity + DbPlanTools — plans 表 CodeFirst 自动建表，6 个 DB 端点注册到 DbModule
  - PromptBuilder guidance 通过工具返回值注入而非 system prompt
  - AgentRuntimePlanExecutor.cs 拆分为 4 个 partial class（778→525+80+87+119）
  - 双编译零错误：tsc --noEmit (3 configs) + dotnet build

### v2-iter-7：主聊天折叠块模式
- 状态：已完成
- 分支：dev/v2-iter-7（已合并 main）
- VERDICT: PASS
- Tag: v2.7.0
- Commit: a36f392
- 日期: 2026-08-04
- 备注：
  - ExecutionProcessBlock 折叠块组件 — 执行中展开，结束后自动折叠成摘要，用户可手动 toggle
  - 过程/最终文本拆分 — 从 render items 末尾向前扫描，执行过程（thinking/tool_use）包裹在折叠块内，最终输出（text/image）在折叠块之外
  - 按工具分类摘要 — 细分 commands/reads/edits/browser/desktop/orchestration/mcp/interactive/visual/skill/other
  - collapsible 动态计算 — 只有存在工具调用时才折叠，纯思考+回复不折叠
  - 取消执行处理 — 取消时也折叠过程，最终回复区域显示固定文本
  - 缓存命中率修复 — 从 session 级请求计数改为 token 级口径（cacheRead/input），修复 session 恢复后后端计数器丢失导致百分比不准
  - 原计划含右侧工作台 tab + ToolCallCard compact 模式，开发中决策去掉（折叠块内 ToolCallCard 本身有展开预览能力，compact 模式去掉再补工作台是绕圈子）
  - content-renderer.tsx 从 525 行拆分至 494 行（提取 splitProcessAndFinal 到 process-summary.ts）

### v2-iter-6：SSH 远程执行 + Agent 终端旁观 + 项目档案
- 状态：已完成
- 分支：dev/v2-iter-6（已合并 main）
- VERDICT: PASS
- Tag: v2.6.0
- Commit: e1529ee
- 日期: 2026-08-04
- 备注：
  - Agent SSH 输出不自动展开终端面板，输出在面板隐藏时仍写入 xterm 缓冲
  - 终端面板可见性从 project 级改为 session 级（bottomTerminalDockOpenBySessionId）
  - 非 SSH 项目无 ssh_capability 提示块（BuildSshContext 返回 Empty）
  - BuildSshContext 只在 SSH 项目时调用（sshConnectionId 检查）
  - Bash 工具加 `local: true` 逃生口，SSH 项目中 Agent 可操作本地
  - ShellExecuteTool.cs 901 行拆分为 4 个 partial class（AGENTS.md 规范）
  - ProjectArchivePage.tsx 765 行拆分为 3 个文件
  - 终端关闭不自动收起面板，用户手动控制
  - 终端 i18n 补全（16 个 key 加到 zh/en layout.json）
  - 本地项目首次打开终端面板自动创建终端（dockOpen 时触发）
  - node-pty native module 打包修复（electron.vite.config.ts external）

### v2-iter-5：渠道配置测试与完善
- 状态：已完成
- 分支：dev/v2-iter-5（已合并 main）
- VERDICT: PASS
- Tag: v2.5.0
- Commit: 8822390
- 日期: 2026-08-03
- 备注：
  - Channel 系统初始化（ChannelManager + 注册 + autoStart + stopAll）
  - 8 个渠道中文化 + 顺序调整（微信/飞书/QQ/钉钉/企业微信/国际）
  - 飞书 OAuth Device Flow 扫码绑定（参考 Reasonix）
  - 微信长轮询扫码绑定
  - auto-reply hook（渠道消息→sendMessage→Agent Loop→回复发回渠道）
  - 会话标题带渠道前缀（飞书: 桃子）
  - 全局渠道设置区（人格选择 + Provider/Model 选择）
  - 布局参考 Reasonix：上方渠道列表+详情，下方全局设置
  - 渠道三态状态显示 + 启动时查询实际状态
  - channel-plugin-handlers.ts 拆分为 3 个文件（CRUD/Session/Stream）
  - 安装 bufferutil/utf-8-validate（ws 原生依赖）、react-pdf/xlsx/mammoth（前端预览）

## 后续迭代规划

### 迭代九：输入框修复 + 提示词优化器
- 状态：已完成（dev/iter-11 分支，待合并 main）
- 优先级：高 — 直接影响使用体验
- 目标：修复输入框底部 token 统计全为 0 的问题；实现提示词优化器功能

| Plan | 内容 | 涉及文件 | 说明 |
|------|------|----------|------|
| 9-1 | 提示词优化器实现 | `src/renderer/src/lib/prompt-optimizer/optimizer.ts` | 从 OpenCowork 移植，复用已有 `streamSidecarProviderTurn` + `usePromptOptimizer` hook。当前 optimizer.ts 是空壳 stub |
| 9-2 | Token 统计修复 | `OpenAIChatSseParser.cs` / `runtime-status.tsx` | 排查 usage 是否为 null（疑似中转商不支持 `stream_options.include_usage`）。若确认无 usage 返回，后端做 fallback 估算 |
| 9-3 | AGENTS.md 路径修正 | `AGENTS.md` | 参考项目路径从 `D:\gy\*` 更新为 `D:\claw\*`（笔记本实际路径） |

- 技术要点：
  - 提示词优化器：OpenCowork 方案是用 `streamSidecarProviderTurn`（`providerTurnOnly: true`）做单轮 LLM 调用，给模型提供 `WriteOptimizedPrompts` 工具返回 1-3 个优化方案。wishful-claw 已有 `streamSidecarProviderTurn`，可直接复用
  - Token 统计：数据链路（C# Worker → MessagePack 编码 → IPC → 前端解码 → chat-store → ComposerRuntimeStatus）代码逻辑无误，最可能是中转商不返回 usage。需加日志确认

### 迭代十：子 Agent（Sub-Agent）
- 状态：已完成（dev/iter-11 分支，待合并 main）
- 优先级：高 — 功能扩展核心方向
- 目标：实现子 Agent 的创建、执行、事件流和前端渲染
- 前端已有骨架：`OrchestrationBlock`、`OrchestrationMemberStrip`、`SubAgentCard` 等组件
- 参考来源：OpenCowork `sub-agents/` 目录
- 技术要点：
  - 子 Agent 生命周期管理（独立 runId，挂载到父 Agent state）
  - 事件流（`sub_agent_start` / `sub_agent_progress` / `sub_agent_end`）
  - Task 工具：父 Agent 通过工具调用启动子 Agent
  - 前端事件适配和渲染

### 迭代十一：右侧面板 + 子 Agent 架构增强 + 终端/文件管理
- 状态：已完成（dev/iter-11 分支，待合并 main）
- 优先级：高
- 目标：右侧面板动态 Tab 系统、子 Agent 架构五阶段增强、终端面板与文件管理快捷入口
- 备注：8 个 Plan 全部完成，tsc + build + dotnet build 通过。遗留：agent:changes stub、代码拆分、合并 main
- 技术要点：
  - 工具调用卡片的折叠/展开交互
  - Thinking block 展示优化
  - 消息间距和视觉层次
  - Agent Loop 多轮迭代的展示方式（当前平铺在一条消息内，可能调整为分段展示）

### 迭代十二：SSH 远程执行 + Agent 终端旁观
- 状态：已完成（v2-iter-6）
- VERDICT: PASS
- Tag: v2.6.0
- Commit: e1529ee
- 日期: 2026-08-04
- 目标：Agent 通过 SSH 长连接远程执行命令，执行过程实时输出到终端面板供用户旁观
- 备注：已完成，详见上方 v2-iter-6 条目

### 迭代十三：聊天窗渲染调整（参考灵犀）
- 状态：已完成（v2-iter-7）
- VERDICT: PASS
- Tag: v2.7.0
- 日期: 2026-08-04
- 目标：借鉴灵犀工作台模式，聊天窗统一用折叠块组件渲染 Agent 回复
- 备注：已完成，详见上方 v2-iter-7 条目

### 迭代十四：Skill 市场
- 状态：未开始
- 优先级：中 — 生态扩展
- 目标：实现 Skill 的安装/卸载/列表管理和在线市场

### 迭代十五：MCP 管理
- 状态：未开始
- 优先级：中 — 生态扩展
- 目标：实现 MCP Server 的配置管理和工具调用
- 前端已有骨架：`mcp-store`
- 技术要点：
  - MCP Server 配置管理
  - MCP 工具动态注册和调用
  - MCP 状态监控
