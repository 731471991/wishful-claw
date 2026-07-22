# 新会话启动提示语

> 复制以下内容到新会话作为第一条消息发送。

---

我是 wishful-claw 项目的作者，这是一个 Agent 编程软件，融合三个开源项目的优点：OpenCowork（Agent Loop / 工具链 / Provider / 架构）、KodaClaw（记忆系统 / 人格系统设计）、OpenClaw.net（记忆主动回忆机制）。

**项目路径**：`D:\claw\wishful-claw`
**GitHub**：731471991/wishful-claw
**技术栈**：React + Electron（前端）+ .NET 10（后端）+ MessagePack（IPC 通信）

**开工前请先阅读以下文档**：
1. `AGENTS.md` — 项目结构、分层约定、参考源码路径
2. `docs/iteration-plan.md` — 8 个迭代计划，当前执行迭代五
3. `docs/dev-workflow.md` — 六阶段开发工作流 SOP（含 Git 工作流）
4. `docs/mvp-scope.md` — MVP 边界
5. `docs/data-storage.md` — 数据存储设计
6. `docs/project-structure.md` — 目录结构说明

**参考源码位置**：
- OpenCowork：`D:\gy\OpenCowork`（搬入 Agent Loop / 工具链 / Provider / 前端 UI / SQLite DB 层）
- KodaClaw：`D:\gy\koda-claw\koda-claw`（参考记忆 / 人格设计思路）
- OpenClaw.net：`D:\claw\openclaw.net`（参考记忆主动回忆 / 上下文预算）

**当前状态**：
- 迭代一~四已完成，当前在 `dev/iter-4` 分支上（迭代四代码完成，待用户确认完结后合并 main）
- **本次新开 `dev/iter-5` 分支**，从 `dev/iter-4`（或 main，取决于迭代四是否已合并）切出
- 迭代五目标：项目注册 + 会话历史（SQLite 持久化）

**已完成的基础设施**（迭代一~四）：
- Electron + React 前端 + .NET 10 后端 + MessagePack IPC 通信全链路打通
- Provider 配置（28 个预设 + CRUD + 连通性测试 + 模型拉取）
- Agent Loop（流式对话 + 取消 + 上下文压缩）
- 工具链（7 个工具：Read/Write/Edit/LS/Glob/Grep/Bash + 工具调用 UI）
- 前端布局完整搬自 OpenCowork（NavRail + WorkspaceSidebar + TitleBar + SessionConversationPane + ChatHomePage + ProjectHomePage）
- 聊天 UI 完整可用（流式渲染 + 工具调用卡片 + ModelSwitcher + 消息导航条）

**迭代五的现状（已有的桩代码）**：
- 前端 `src/renderer/src/stores/chat-store/db-helpers.ts` — 全是 placeholder no-op，标注了 `TODO (迭代五): Implement with SQLite via MessagePack IPC`
- 前端 `src/renderer/src/stores/chat-store/types.ts` — `Session` 和 `Project` 类型已定义完整（字段对齐 OpenCowork）
- 前端 `src/renderer/src/stores/chat-store/session-slice.ts` — 会话 CRUD 逻辑完整，但调用 `dbCreateSession` 等 placeholder 不持久化
- 前端 `src/renderer/src/stores/chat-store/project-slice.ts` — 项目 CRUD 逻辑完整，同样不持久化
- 前端 `src/main/ipc/` — 目前只有 agent-stream/ai-provider/settings/messagepack 四个 handler，没有 DB handler
- 后端 `src/runtime/WishfulClaw.Worker/` — 目前有 SystemModule/ConfigModule/ProviderModule/ProviderTestModule/AgentRuntimeModule/ToolModule，**没有 DbModule**
- 后端没有任何 SQLite 依赖（csproj 中无 `Microsoft.Data.Sqlite`）
- 后端 `WishfulClaw.Worker/WorkerModuleCatalog.cs` — 模块注册目录，需要添加 DbModule

**OpenCowork 的 DB 层参考**（直接搬入并精简）：
- 后端 C#：`D:\gy\OpenCowork\sidecars\OpenCowork.Native.Worker\Modules\Db\` — 完整的 DbModule + DbConnectionFactory + DbSchemaMigrator + DbProjectTools/DbSessionTools/DbMessageTools 等
  - `DbConnectionFactory.cs` — SQLite 连接管理（WAL 模式、PRAGMA 配置、dbPath 解析）
  - `DbSchemaMigrator.cs` — 建表脚本（sessions / messages / projects 三张核心表）
  - `DbProjectTools.cs` + `DbProjectModels.cs` — 项目 CRUD
  - `DbSessionTools.cs` + `DbSessionModels.cs` — 会话 CRUD
  - `DbMessageTools.cs` + `DbMessageModels.cs` — 消息 CRUD（含分页加载、批量插入）
  - `DbModule.cs` — 注册所有 `db/*` IPC handler
- 前端 TS（Electron Main 侧）：`D:\gy\OpenCowork\src\main\db\` — database.ts + sessions-dao.ts + projects-dao.ts + messages-dao.ts
  - `database.ts` — 调用 native worker `db/initialize`，管理初始化 Promise
  - `*-dao.ts` — 通过 native worker request 调用后端 `db/*` 方法
- 前端 TS（Electron Main IPC）：`D:\gy\OpenCowork\src\main\ipc\db-handlers.ts` — 注册 MessagePack channel，桥接 renderer ↔ native worker
- **wishful-claw 架构差异**：OpenCowork 的前端 DAO 层通过 `getNativeWorker().request()` 直接调用后端；wishful-claw 的前端通过 `window.api.ipc.invoke()` 调用 Electron Main，Main 再转发到 .NET Worker。需要按照现有 wishful-claw 的 IPC 模式适配（参考 `src/main/ipc/ai-provider-handlers.ts` 的转发模式）

**请按 dev-workflow.md 的六阶段 SOP 执行迭代五：项目注册 + 会话历史**。

**会话开始时请先执行**（dev-workflow.md 会话边界规则）：
1. `git status` + `git log --oneline -10` — 定位当前进度
2. `git push` — 推送遗留的未推送 commit（如果有）
3. 读 `docs/PROGRESS.md` — 确认当前迭代和步骤
4. 报告进度摘要，然后继续执行

迭代五流程：探索态 → 规划态 → 规划验证 → **停下来等我确认** → 执行态（自动连续执行 + 每步 commit）→ 审查态 → 验证态 → **停下来等我确认是否达标**。

**不要问"要不要 push""要不要继续下一步"这类工作流有规则的事**，按规则自动走。只在规划确认和验证结果两个节点停下来问我。

**Git 注意事项**：
- 从 `dev/iter-4`（或 main，如果迭代四已合并）切 `dev/iter-5` 分支开发
- 每完成一个步骤立即 commit（Plan 内不 push）
- Plan 所有步骤完成并通过验证后，一次性 push 该 Plan 的所有 commit
- 迭代验证通过后打 tag `v0.5.0`，合并回 main 并 push（**需用户确认后才执行**）

**特别注意**：
- **迭代执行前必须先拆分 Plan**：一个迭代拆 2~4 个 Plan，每个 Plan 是一次会话能吃透的工作单元。不要在一个会话里试图做完整个迭代。详见 docs/iteration-plan.md 开头的「迭代拆分规则」
- **后端 DB 层直接从 OpenCowork 搬入并精简**：OpenCowork 的 DbModule 架构完善（ConnectionFactory + SchemaMigrator + 分表 Tools/Models），搬入时只保留 projects/sessions/messages 三张表，去掉 plans/tasks/goals/ssh/cron/draw/sync/usage/agent-changes 等不需要的表和对应 Tools
- **前端 DB 层按 wishful-claw 的 IPC 模式适配**：OpenCowork 前端 DAO 直接调 native worker，wishful-claw 需要通过 Electron Main 中转。参考现有 `src/main/ipc/ai-provider-handlers.ts` 的转发模式
- **前端 db-helpers.ts 已有桩代码**：所有函数签名已定义好，只需要把 placeholder 实现为真正的 IPC 调用
- **消息持久化要实时**：对话流式输出时就写入 SQLite，不是等对话结束才写。参考 OpenCowork 的 `db/messages-upsert` 模式
- **数据存储路径**：`~/.wishful-claw/index.db`（详见 `docs/data-storage.md`）
- **每个迭代交付必须完整可用**：有入口、有反馈、有闭环，不能是半成品
- **迭代是否完结由用户确认**，Agent 不得自行合并 main / 打 tag / 删分支。详见 docs/iteration-plan.md「迭代完结规则」
- 大文件搬入时必须按职责拆分为多个文件

叫我老大，我们是并肩协作的兄弟。
