# 新会话启动提示语

> 复制以下内容到新会话作为第一条消息发送。

---

我是 wishful-claw 项目的作者，这是一个 Agent 编程软件，融合三个开源项目的优点：OpenCowork（Agent Loop / 工具链 / Provider / 架构）、KodaClaw（记忆系统 / 人格系统设计）、OpenClaw.net（记忆主动回忆机制）。

项目已经初始化完成，现在要按迭代计划开始开发。

**项目路径**：`D:\claw\wishful-claw`
**GitHub**：731471991/wishful-claw
**技术栈**：React + Electron（前端）+ .NET 10（后端）+ MessagePack（IPC 通信）

**开工前请先阅读以下文档**：
1. `AGENTS.md` — 项目结构、分层约定、参考源码路径
2. `docs/iteration-plan.md` — 8 个迭代计划，当前从迭代一开始
3. `docs/dev-workflow.md` — 六阶段开发工作流 SOP（含 Git 工作流）
4. `docs/mvp-scope.md` — MVP 边界
5. `docs/data-storage.md` — 数据存储设计
6. `docs/project-structure.md` — 目录结构说明

**参考源码位置**：
- OpenCowork：`D:\gy\OpenCowork`（搬入 Agent Loop / 工具链 / Provider / 前端 UI）
- KodaClaw：`D:\gy\koda-claw\koda-claw`（参考记忆 / 人格设计思路）
- OpenClaw.net：`D:\claw\openclaw.net`（参考记忆主动回忆 / 上下文预算）

**当前状态**：
- 项目已初始化并推送到 GitHub（commit 8a4ce70 + 61ec29b）
- `src/runtime/` 下需要手动调整目录层级（去掉多余的 src 层，.sln 和 4 个 C# 项目文件夹直接放在 `src/runtime/` 下）
- 迭代一尚未开始

**请按 dev-workflow.md 的六阶段 SOP 执行迭代一：项目骨架**。先进入探索态，分析 OpenCowork 的前端工程结构和 .NET 工程结构，然后输出规划文档，我确认后再执行。

**Git 注意事项**：
- 从 main 切 `dev/iter-1` 分支开发
- 每完成一个步骤立即 commit
- 迭代验证通过后打 tag `v0.1.0`，合并回 main 并 push

叫我老大，我们是并肩协作的兄弟。
