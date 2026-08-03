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
| v2-iter-3 | Infrastructure 层拆分 + DeepSeek 缓存命中率深度修复 | ✅ 已完成（待合并 main、打 tag） |

**v2-iter-3 完成的工作**：

Infrastructure 层拆分：
- 新建 `WishfulClaw.Infrastructure` 项目（Db/Storage/Http 三模块，23 文件）
- Db — `DbClient.cs` + `Entities/` 从 Worker 迁入 Infrastructure
- Storage — `ConfigStore.cs` + `ProviderStore.cs` + `JsonFileNodeCache.cs` 从 Worker 迁入 Infrastructure
- Http — `WorkerHttpClientFactory.cs` 从 Agent 迁入 Infrastructure
- Worker Tools — FileTools/SearchTools/ShellTools/Providers 等工具实现迁入 Agent
- Worker 深度瘦身：101 文件 → 12 文件（IPC 宿主 + 模块注册）
- 7 层架构落地：Contracts → Core → Infrastructure → Workspace → Persona → Agent → Worker

DeepSeek prefix cache 命中率深度修复（40%-70% → 93%-99%）：
- 工具定义改为后端解析（前端只发 toolPreset 字符串，AgentLoop 从 ToolModuleState.Registry 获取）
- 请求体字段顺序对齐 Reasonix（model → messages → tools → stream → ...）
- timestamp 注入策略重构（InjectTransientPrefix 合并，直接存入会话历史）
- thinking 配置前后端打通（`thinking:{type:enabled}` 标准格式 + reasoning_content 收集和回传）
- system-reminder 移除（前端不再 buildRuntimeReminder 拼接到用户消息）
- 模型选择器 UI 优化（Brain 图标 + effort 等级显示）
- 工具输出截断（16K head+tail 策略）
- 清理 scripts/ 下 24 个临时脚本 + 诊断代码

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

- 当前分支：`dev/v2-iter-3`，最新 commit: `e5cb326`
- main 最新 commit: `030bf41`，tag `v2.2.0`
- v2-iter-3 全部工作已 commit（Infrastructure 拆分 + 缓存修复），未 push
- TypeScript 编译零错误：`npx tsc --noEmit`
- C# 编译零错误：`dotnet build src/runtime/WishfulClaw.sln`

## 待办：v2-iter-3 合并 main + 后续迭代

v2-iter-3 已完成，需要用户确认后合并 main 并打 tag `v2.3.0`。

后续迭代（v2-iter-4 ~ v2-iter-9 可从 v2-iter-4/5/6 三选一开始，三者互不依赖可并行）：

| 迭代 | 内容 | 依赖 |
|------|------|------|
| v2-iter-4 | Skill 本地文件安装测试 | 无 |
| v2-iter-5 | 渠道配置测试与完善 | 无 |
| v2-iter-6 | SSH 远程执行测试与完善 | 无 |
| v2-iter-7 | 主聊天接入工作台模式 | v2-iter-5 |
| v2-iter-8 | Global 全局模式接入 | v2-iter-7 |
| v2-iter-9 | Goal 模式接入 | v2-iter-7 |

详见 `docs/iteration-plan.md` 中各迭代定义。

## 关键技术备忘

- **编译验证命令**：C# `dotnet build src/runtime/WishfulClaw.sln`（可加 `-o` 临时路径避免文件锁定）；TypeScript `npx tsc --noEmit`
- **TS 零报错规则**：每次写完代码必须跑 tsc 验证，不允许用 @ts-ignore 偷懒（可选依赖 mammoth/react-pdf/xlsx 除外）
- **Git push 需要代理**：`git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin <branch>`
- **分支管理规则**：新分支必须从最新 main 拆出，前一个迭代分支必须已合并 main 并打 tag
- **日志路径**：`%AppData%/WishfulClaw/logs/`
- **DB 路径**：`%USERPROFILE%/.wishful-claw/index.db`
- **C# 文件多为 CRLF 行尾**，批量替换时注意用 Python 脚本处理，file 工具的 edit 容易因行尾不匹配失败

## Git 工作流

- v2-iter-3 待用户确认后合并 main + 打 tag `v2.3.0` + push
- 后续新迭代分支从 main 创建：`git checkout main && git pull && git checkout -b dev/v2-iter-N`
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

1. `git status` + `git log --oneline -5` — 确认当前在 `dev/v2-iter-3`，commit `e5cb326`
2. 读 `AGENTS.md` — 查看 7 层架构和分层约定
3. 读 `docs/iteration-plan.md` — 查看 v2-iter-4 ~ v2-iter-9 定义
4. 确认 v2-iter-3 是否合并 main（用户确认后执行合并 + 打 tag）
5. 选择下一个迭代目标，从 main 创建分支开始执行

叫老大，我们是并肩协作的兄弟。
