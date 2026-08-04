# 新会话启动提示语

> 复制以下内容到新会话作为第一条消息发送。

---

老大，继续 wishful-claw 开发。这是 Agent 编程软件，融合三个开源项目：OpenCowork（Agent Loop / 工具链 / Provider / 架构）、KodaClaw（记忆系统 / 人格系统设计）、OpenClaw.net（记忆主动回忆机制）。

**项目路径**：`D:\claw\wishful-claw`
**GitHub**：731471991/wishful-claw
**技术栈**：React 19 + Electron 35（前端）+ .NET 10（后端）+ MessagePack（IPC 通信）

## 开工前请先阅读以下文档

1. `AGENTS.md` — 项目结构（7 层架构）、分层约定、Git 提交规范、分支管理规则、大文件拆分规则
2. `docs/dev-workflow.md` — 六阶段开发工作流 SOP
3. `docs/iteration-plan.md` — 总体迭代计划（迭代一~十五 + MVP v2 迭代 v2-iter-1 ~ v2-iter-9）

## 参考源码位置（笔记本实际路径）

- OpenCowork：`D:\claw\OpenCowork`（Agent Loop / 工具链 / Provider / 前端 UI / Skill / MCP，代码已迁移）
- KodaClaw：`D:\claw\koda-claw`（记忆 / 人格设计思路，代码已迁移）
- OpenClaw.net：`D:\claw\openclaw.net`（记忆主动回忆 / 上下文预算，代码已迁移）
- DeepSeek-Reasonix：`D:\claw\DeepSeek-Reasonix`（prefix cache / 重试策略 / 上下文压缩参考）

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

## 当前项目架构（7 层）

```
Contracts (4 文件)      — 纯接口契约
  ↑
Core (19 文件)           — Agent 通用框架（Protocol + Tools）
  ↑
Infrastructure (23 文件)  — Db/Storage/Http 基础设施
  ↑
Workspace (12 文件)      — 记忆系统
  ↑
Persona (9 文件)         — 人格系统
  ↑
Agent (145 文件)          — Agent 运行时（Loop / Provider / Executor / Compression / SubAgent / Tools）
  ↑
Worker (12 文件)          — IPC 宿主 + 模块注册
```

## 当前状态

- 当前分支：`main`，最新 tag：`v2.7.0`
- v2-iter-7 已合并 main 并打 tag，开发分支已清理
- TypeScript 编译零错误：`npx tsc --noEmit -p tsconfig.web.json`
- C# 编译零错误：`dotnet build src/runtime/WishfulClaw.sln`

## v2-iter-7 实际实现（与原计划差异说明）

原计划包含右侧工作台 tab + ToolCallCard compact 模式。开发过程中用户决策去掉右侧工作台——折叠块内的 ToolCallCard 本身就有展开/折叠预览能力（CollapsibleHeightPanel），compact 模式去掉这个能力再搞工作台补回来是绕圈子。最终保留的改动：

- **ExecutionProcessBlock**（`execution-process-block.tsx`）— 折叠块组件，执行中展开，结束后自动折叠成摘要，用户可手动 toggle
- **过程/最终文本拆分**（`content-renderer.tsx` + `process-summary.ts`）— 从 render items 末尾向前扫描，区分"执行过程"（thinking/tool_use/tool-run）和"最终输出"（text/image），过程包裹在折叠块内，最终输出在折叠块之外
- **按工具分类摘要**（`process-summary.ts`）— 细分 commands/reads/edits/browser/desktop/orchestration/mcp/interactive/visual/skill/other，每类独立摘要文本
- **collapsible 动态计算** — 只有存在工具调用时才折叠，纯思考+回复不折叠
- **取消执行处理** — 取消时也折叠过程，最终回复区域显示"用户取消，中断执行"固定文本
- **缓存命中率修复**（`runtime-status.tsx`）— 从 session 级请求计数改为 token 级口径（cacheRead/input），修复 session 恢复后后端计数器丢失导致百分比与显示数字不一致的问题

## 下一步：v2-iter-8 计划模式（人机协同执行引擎）

**目标**：单个计划的人机协同执行引擎。Agent 接收需求后走"探索→规划→产出计划文件→用户确认→分步执行→验证"流程，计划文件和任务状态落盘到 `.wishful-claw/` 固定位置，可被外部读取。

**核心概念**：
- **计划模式**是单个计划的执行引擎（人机协同，需要用户确认）
- **Goal 模式**（v2-iter-9）是迭代级别的自主执行——Agent 自己把迭代拆成多个计划，每个计划自主走完整流程（不要人确认），跑完整个迭代
- **全局编排**（v2-iter-10）最后接上读任务文件，跨项目调度

| 步骤 | 内容 |
|------|------|
| 1 | 计划模式状态机 — explore → plan → confirm → execute → verify |
| 2 | 计划文件格式 — `.wishful-claw/` 下的计划文件和任务状态文件（计划标题、步骤清单、每步状态、执行结果摘要） |
| 3 | 状态落盘 — 执行过程中实时更新任务状态文件，外部可读取"当前在做什么、做到哪了" |
| 4 | 用户确认环节 — 规划完成后暂停等待确认，确认后才执行；每步 Mini 验证 |
| 5 | 前端计划面板 — 步骤清单 + 实时状态 + 验证结果 |

详见 `docs/iteration-plan.md` 中 v2-iter-8 定义。

**后续迭代**：
- v2-iter-9：Goal 模式 — 自主跑完迭代，复用计划模式去掉人工确认 + 多计划编排
- v2-iter-10：全局会话 + 项目编排工具 — 读任务文件，跨项目调度

## 关键技术备忘

- **编译验证命令**：C# `dotnet build src/runtime/WishfulClaw.sln`（可加 `-o` 临时路径避免文件锁定）；TypeScript `npx tsc --noEmit -p tsconfig.web.json`（必须带 `-p`！）
- **TS 零报错规则**：每次写完代码必须跑 tsc 验证，不允许用 @ts-ignore 偷懒（可选依赖 mammoth/react-pdf/xlsx 除外）
- **Git push 需要代理**：`git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin <branch>`
- **分支管理规则**：新分支必须从最新 main 拆出，前一个迭代分支必须已合并 main 并打 tag
- **日志路径**：`%AppData%/WishfulClaw/logs/`
- **DB 路径**：`%USERPROFILE%/.wishful-claw/index.db`
- **C# 文件多为 CRLF 行尾**，批量替换时注意用 Python 脚本处理，file 工具的 edit 容易因行尾不匹配失败

## Git 工作流

- 新迭代分支从 main 创建：`git checkout main && git checkout -b dev/v2-iter-8`
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

1. `git status` + `git log --oneline -5` — 确认当前在 `main`，最新 tag `v2.7.0`
2. 读 `AGENTS.md` — 查看 7 层架构和分层约定
3. 读 `docs/iteration-plan.md` — 查看 v2-iter-8 定义
4. 从 main 创建分支：`git checkout -b dev/v2-iter-8`
5. 开始执行 v2-iter-8 计划模式开发

叫老大，我们是并肩协作的兄弟。
