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

- 当前分支：`main`，最新 tag：`v2.6.0`
- v2-iter-6 已合并 main 并打 tag，开发分支已清理
- TypeScript 编译零错误：`npx tsc --noEmit`
- C# 编译零错误：`dotnet build src/runtime/WishfulClaw.sln`

## 下一步：v2-iter-7 主聊天接入工作台模式

**目标**：借鉴灵犀的工作台模式——聊天窗内工具执行过程折叠为摘要块，完整预览移至右侧面板"工作台" tab，实现聊天流清爽 + 执行详情分离。

| 步骤 | 内容 |
|------|------|
| 1 | 新建折叠摘要组件 — Agent 执行工具/命令后，聊天消息内不再内联渲染 ToolCallCard 详情，而是显示折叠块（"运行了XX个命令，查看了X个文件，编辑了X个文件"），下方接 Agent 回复正文 |
| 2 | ToolCallCard 迁移至右侧工作台 — 完整的工具调用预览（命令输出、文件 diff 等）从聊天流移到 RightPanel 新增的"工作台" tab |
| 3 | 工作台会话级隔离 — 切换会话时工作台内容跟随切换，按 sessionId 存储 |
| 4 | 折叠触发时机 — 执行了命令/工具即折叠，或 Agent Loop 超过 2 轮后折叠 |
| 5 | 保留现有执行后操作按钮（debug 等） |

**验证标准**：发送消息 → Agent 执行工具 → 聊天窗显示折叠摘要 + Agent 回复（不内联预览）→ 右侧工作台 tab 展示完整工具调用详情 → 切换会话工作台内容跟随隔离。

详见 `docs/iteration-plan.md` 中 v2-iter-7 定义。

## 关键技术备忘

- **编译验证命令**：C# `dotnet build src/runtime/WishfulClaw.sln`（可加 `-o` 临时路径避免文件锁定）；TypeScript `npx tsc --noEmit -p tsconfig.web.json`
- **TS 零报错规则**：每次写完代码必须跑 tsc 验证，不允许用 @ts-ignore 偷懒（可选依赖 mammoth/react-pdf/xlsx 除外）
- **Git push 需要代理**：`git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin <branch>`
- **分支管理规则**：新分支必须从最新 main 拆出，前一个迭代分支必须已合并 main 并打 tag
- **日志路径**：`%AppData%/WishfulClaw/logs/`
- **DB 路径**：`%USERPROFILE%/.wishful-claw/index.db`
- **C# 文件多为 CRLF 行尾**，批量替换时注意用 Python 脚本处理，file 工具的 edit 容易因行尾不匹配失败

## Git 工作流

- 新迭代分支从 main 创建：`git checkout main && git checkout -b dev/v2-iter-7`
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

1. `git status` + `git log --oneline -5` — 确认当前在 `main`，最新 tag `v2.6.0`
2. 读 `AGENTS.md` — 查看 7 层架构和分层约定
3. 读 `docs/iteration-plan.md` — 查看 v2-iter-7 定义
4. 从 main 创建分支：`git checkout -b dev/v2-iter-7`
5. 开始执行 v2-iter-7 工作台模式开发

叫老大，我们是并肩协作的兄弟。
