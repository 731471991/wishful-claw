# 新会话启动提示语

> 复制以下内容到新会话作为第一条消息发送。

---

老大，继续 wishful-claw 开发。这是 Agent 编程软件，融合五个开源项目：OpenCowork（Agent Loop / 工具链 / Provider / 架构）、KodaClaw（记忆系统 / 人格系统设计）、OpenClaw.net（记忆主动回忆机制）、DeepSeek-Reasonix（缓存命中率 / 工具注册发现 / 工具注入体系）、OpenAI Codex（Goal 模式状态机 / 自检评估机制）。

**项目路径**：`D:\claw\wishful-claw`
**GitHub**：731471991/wishful-claw
**技术栈**：React 19 + Electron 35（前端）+ .NET 10（后端）+ MessagePack（IPC 通信）

## 开工前请先阅读以下文档

1. `AGENTS.md` — 项目结构（7 层架构）、分层约定、Git 提交规范、分支管理规则、大文件拆分规则
2. `docs/dev-workflow.md` — 六阶段开发工作流 SOP
3. `docs/iteration-plan.md` — 总体迭代计划（迭代一~十五 + MVP v2 迭代 v2-iter-1 ~ v2-iter-12）
4. `D:\koda\Obsidian\02-AI教学\wishfulclaw` — 老大持续更新的 Wishful Claw Bug 与优化建议知识库；规划新迭代前先检查最新内容

## 【最重要】每个新迭代开始，必须先与老大讨论确认

**不要按 `docs/iteration-plan.md` 默认规划的迭代直接开工。**

历史经验：计划文档里默认规划的迭代（步骤、范围、验证标准）在实际使用中常与真实需求有差异——它是"规划草案"，不是最终需求。开工前必须：

1. **先读文档**：`docs/iteration-plan.md` + `docs/PROGRESS.md`（看已完结迭代与最新 tag）
2. **主动与老大确认本次迭代的具体范围**：做什么、优先级、边界、验证标准，以老大口头/对话中确认的需求为准
3. **计划文档仅作参考**：可据此提建议，但最终以老大确认的为准；发现实际需求与计划不符时，按实际需求调整并告知老大

**切勿**拿到计划文档后不经确认就默认执行。

## 参考源码位置（笔记本实际路径）

- OpenCowork：`D:\claw\OpenCowork`（Agent Loop / 工具链 / Provider / 前端 UI / Skill / MCP，代码已迁移）
- KodaClaw：`D:\claw\koda-claw`（记忆 / 人格设计思路，代码已迁移）
- OpenClaw.net：`D:\claw\openclaw.net`（记忆主动回忆 / 上下文预算，代码已迁移）
- DeepSeek-Reasonix：`D:\claw\DeepSeek-Reasonix`（prefix cache / 重试策略 / 上下文压缩 / 工具注册发现 / 工具注入体系参考）
- OpenAI Codex：开源仓库 `github.com/openai/codex`（Goal 模式状态机 plan→execute→verify→continue/adjust、自检评估机制参考）

> 以上参考项目代码已全部迁移并适配为 WishfulClaw 命名空间，仅作历史溯源，开发时不再直接参考。

## 已完成的工作

### MVP v1（迭代一~十五，已合并 main，tag v0.15.0）

核心链路全部完成：Agent Loop + 工具链 + 记忆 + 人格 + Skill 市场 + MCP 管理 + SSH 远程执行 + 终端面板 + 子 Agent + 右侧面板。

### MVP v2 迭代

| 迭代 | 内容 | 状态 |
|------|------|------|
| v2-iter-1 | Runtime 分层架构重构 — Worker 拆分为 Agent + Persona，Worker 瘦身 45% | ✅ 已完成，tag v2.1.0 |
| v2-iter-2 | 缓存命中率修复 — SessionConversation 增量模式 + LLM 总结式上下文压缩 + 版本号统一 + OpenCowork 名称清理 + 7 层架构文档 | ✅ 已完成，tag v2.2.0 |
| v2-iter-3 | Infrastructure 层拆分 + DeepSeek 缓存命中率深度修复 | ✅ 已完成，tag v2.3.0 |
| v2-iter-5 | 渠道配置测试与完善 — Channel 系统 + 飞书/微信扫码绑定 + auto-reply hook + 全局渠道设置 | ✅ 已完成，tag v2.5.0 |
| v2-iter-6 | SSH 远程执行 + Agent 终端旁观 + 项目档案 + 终端面板重构（session 级可见性、auto-create、i18n、node-pty 打包修复） | ✅ 已完成，tag v2.6.0 |
| v2-iter-7 | 主聊天折叠块模式 — ExecutionProcessBlock 折叠块组件 + 过程/最终文本拆分 + 按工具分类摘要 + 缓存命中率 token 级修复 | ✅ 已完成，tag v2.7.0 |
| v2-iter-8 | 计划模式（人机协同执行引擎）— explore→plan→confirm→execute→verify 状态机 + 计划文件/状态文件落盘 + SubmitPlanReview reverse request 用户确认 + PlanReviewCard + UpdatePlanStep 步骤跟踪 | ✅ 已完成，tag v2.8.0 |
| v2-iter-9 | Goal 模式（自主跑完迭代）— GoalOrchestrator 编排层 + 自确认/自检评估 + 429 限流长退避 + 可中断 + 前端 Goal 进度面板 + 上下文压缩阈值统一 + 内置浏览器修复 + 配色默认远航蓝 + AOT 兼容配置 | ✅ 已完成，tag v2.9.0，已合并 main |
| v2-iter-10 | 全局会话 + 项目编排工具 — 4 个项目工具（list_projects/get_project_details/create_session/send_session_message），global sessionMode，ToolProvider availableModes 扩展，send_session_message reverse request 链路 | ✅ 已完成，tag v2.10.0 |
| v2-iter-11 | Native AOT 打包 — SqlSugar → Microsoft.Data.Sqlite 迁移 + AOT 反射序列化消除 + Json 显式传参 + 系统托盘 | ✅ 已完成，tag v2.11.0，已合并 main |
| v2-iter-12 | Goal 生命周期一致性与阻断缺陷修复 — 状态/运行态分离、唯一运行循环、取消安全点、历史永久保留、稳定分页、可审计重开、Goal 工具与 use_capability 接入 | ✅ 已完成，产品版本 0.2.12，tag v0.2.12，已合并 main |
| v2-iter-13 | OpenAI Responses API + 请求超时配置 + 文件树/输入框/设置页收口 — Responses Provider（5 文件）、全局超时配置、AgentFileTreeToolbar、搜索结果类型修复、终端路径传入选中目录、文件树持久化、ComposerStatusIndicator、移除死代码 5 文件 | ✅ 已完成，产品版本 0.2.13，tag v0.2.13，已合并 main |

## 当前项目架构（7 层）

```
Contracts (4 文件)      — 纯接口契约
  ↑
Core (19 文件)           — Agent 通用框架（Protocol + Tools）
  ↑
Infrastructure (25 文件)  — Db/Storage/Http 基础设施
  ↑
Workspace (12 文件)      — 记忆系统
  ↑
Persona (9 文件)         — 人格系统
  ↑
Agent (148 文件)          — Agent 运行时（Loop / Provider / Executor / Compression / SubAgent / Tools / Plan）
  ↑
Worker (12 文件)          — IPC 宿主 + 模块注册
```

## 当前状态

- 当前分支：`main`，当前产品版本：`0.2.13`，最新 tag：`v0.2.13`
- v2-iter-13（OpenAI Responses API + 请求超时配置 + 文件树/输入框/设置页收口）已完成，已合并 main 并打 tag v0.2.13，开发分支已清理
- 验证：TypeScript 3/3 PASS；C# build 0 错误；用户人工验证通过
- 下一步：先检查 `D:\koda\Obsidian\02-AI教学\wishfulclaw` 的最新 Bug/优化建议，再与老大讨论下一迭代范围

## v2-iter-8 实际实现

计划模式人机协同执行引擎，Agent 接收需求后走"探索→规划→产出计划文件→用户确认→分步执行→验证"流程。计划文件和任务状态落盘到 `.wishful-claw/` 固定位置，可被外部读取。

- **计划模式状态机** — explore → plan → confirm → execute → verify，Agent 通过工具调用驱动状态流转
- **计划工具**（`AgentRuntimePlanExecutor.cs`，partial class 拆分为 4 文件）— EnterPlanMode（进入/恢复计划）、SubmitPlanReview（提交审查，通过 reverse request 暂停 agent loop 等待用户确认）、ExitPlanMode（取消计划）、UpdatePlanStep（步骤状态跟踪）
- **计划文件格式** — `.wishful-claw/plans/{planId}.md`（计划内容）+ `{planId}.state.json`（步骤清单 + 每步状态 + 执行结果摘要）
- **状态落盘** — 执行过程中实时更新 state.json，外部可读取"当前在做什么、做到哪了"
- **用户确认环节** — SubmitPlanReview 通过 reverse request（同 AskUserQuestion 模式）暂停 agent loop；PlanReviewCard 展示计划 + Implement/Adjust 两个按钮；Exit Plan Mode banner 按钮处理两种场景（agent 流式中 cancelStream + sendMessage，等待 review 时 cancelPlanReview resolve cancelled）
- **前端** — PlanReviewCard（计划审查卡片 + 反馈输入）、plan mode banner（session 级隔离 planModesBySession）、plan-store 从 invokeMessagePackBinary 迁移到 workerRequest
- **DB 层** — PlanEntity + DbPlanTools（6 个 DB 端点），CodeFirst 自动建表
- **PromptBuilder guidance** — 计划模式引导通过工具返回值注入而非 system prompt

## v2-iter-10 实际实现

全局会话作为"项目经理"小助手，不绑项目目录，通过 4 个项目工具与各项目下的会话交互。

- **工具注册**（`ProjectToolsProvider.cs`）— list_projects / get_project_details / create_session / send_session_message 四个工具定义，Category="project"，AvailableModes=["global"]
- **后端执行器**（`AgentRuntimeProjectExecutor.cs`）— list_projects 查 DB 返回项目列表（含活跃会话数），get_project_details 查项目会话 + 读 `.wishful-claw/project-status.md` 文件（不存在时返回 statusUpdateTemplate 让 Agent 自主决定是否触发整理），create_session 给项目建新会话，send_session_message 通过 reverse request 转发到 renderer
- **send_session_message 链路** — Worker → reverse request "project/send-session-message" → Main 进程 rendererMethods → Renderer renderer-tool-bridge → chat-store.sendMessage()（fire-and-forget，异步执行）
- **ToolDispatchRouter 路由** — 新增 `AgentRuntimeProjectExecutor.IsProjectTool()` 分支分发 4 工具
- **ToolPreset** — chat/coding preset 的 AllowedCategories 加入 "project" 类别
- **sessionMode** — 新增 "global" 模式，InputArea 根据 `!activeProjectId` 自动设置 sessionMode="global"，各 ToolProvider 的 availableModes 扩展 "global"
- **状态文件** — 固定目录 `.wishful-claw/project-status.md`，项目会话收到固定模版消息后自行整理输出，get_project_details 只读此文件，不扫描 plans/goals 目录兜底

## 下一步（需与老大讨论确认后确定）

当前已完成 v2-iter-13（产品版本 0.2.13，tag v0.2.13）。下一迭代范围待与老大讨论确认。

1. 先检查 `D:\koda\Obsidian\02-AI教学\wishfulclaw` 中最新的 Bug 和优化建议。
2. 听取老大新想法，整理优先级、范围、边界和验证标准。
3. 以老大确认的实际需求为准，不直接照搬 `docs/iteration-plan.md` 的旧候选项。

后续独立 Plan 候选：历史消息反向分页、模型管理页面、Goal 编排记录可视化、工具调用权限、Cron 自动化验证。

**开工前先与老大确认本次迭代具体做什么、优先级、边界。**

## 关键技术备忘

- **编译验证命令**：C# `dotnet build src/runtime/WishfulClaw.sln`（可加 `-o` 临时路径避免文件锁定）；TypeScript 三个配置必须全部零错误（缺一不可）：
  - `npx tsc --noEmit -p tsconfig.web.json`（渲染进程）
  - `npx tsc --noEmit -p tsconfig.node.json`（主进程）
  - `npx tsc --noEmit -p tsconfig.json`（根配置）
  - 必须带 `-p`！不带 `-p` 只走 references 不检查文件内容，等于没验证
- **TS 零报错规则**：每次写完代码必须跑 tsc 验证，不允许用 @ts-ignore 偷懒（可选依赖 mammoth/react-pdf/xlsx 除外）
- **Git push 需要代理**：`git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin <branch>`
- **分支管理规则**：新分支必须从最新 main 拆出，前一个迭代分支必须已合并 main 并打 tag
- **日志路径**：`%AppData%/WishfulClaw/logs/`
- **DB 路径**：`%USERPROFILE%/.wishful-claw/index.db`
- **C# 文件多为 CRLF 行尾**，批量替换时注意用 Python 脚本处理，file 工具的 edit 容易因行尾不匹配失败

## Git 工作流

- 新迭代分支从 main 创建：`git checkout main && git checkout -b dev/v2-iter-{N}`
- **功能单元测试通过后才 commit**，不要改一点就提交
- Plan 执行期间只 commit 不 push，Plan 完成后才 push
- 迭代是否完结由用户确认，Agent 不得自行合并 main / 打 tag / 删分支
- Push 需要代理：`git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin <branch>`

## 代码规范

- 大文件 200~500 行为宜，超 500 行必须拆（AGENTS.md 规则）
- C# 用 partial class，TypeScript 用 export/import 模块化
- 逻辑不相关的代码不放在同一个文件
- 拆分后必须 `tsc --noEmit` + `dotnet build` 双编译验证
- C# 文件名 PascalCase，TypeScript 文件名 kebab-case
- 接口前缀 `I`（C# 遵循 .NET 惯例）

## 会话开始时请先执行

1. `git status` + `git log --oneline -5` — 确认当前在 `main`，产品版本 `0.2.13`，最新 tag `v0.2.13`
2. 读 `AGENTS.md` — 查看 7 层架构和分层约定
3. 读 `docs/iteration-plan.md` + `docs/PROGRESS.md` — 查看已完成迭代与历史计划
4. 检查 `D:\koda\Obsidian\02-AI教学\wishfulclaw` 中最新的 Bug 和优化建议
5. **与老大讨论确认本次迭代范围**（结合昨天的新想法，确认做什么、优先级、边界、验证标准），确认后再开工
6. 新迭代从 main 创建分支：`git checkout main && git pull origin main && git checkout -b dev/v2-iter-{N}`

叫老大，我们是并肩协作的兄弟。
