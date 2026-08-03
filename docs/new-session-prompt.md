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

**v2-iter-2 额外完成的工作**：
- SessionConversation per-session 状态管理（C# 端维护 conversation，前端只发增量消息）
- Prefix cache 断点优化（messages[last] 而非 tools[last]，对齐 Reasonix）
- 时间戳分钟级精度（避免每轮变化破坏缓存）
- LLM 总结式上下文压缩（参考 Reasonix compact.go，7 段式结构化 briefing + PlanCompaction 分区折叠 + 90s 超时重试）
- 压缩设置 UI（Switch + Slider 30%-90%，从前端传递到 C# 端）
- 版本号单一来源（app-version.ts 从 package.json 读取，3 处显示统一引用）
- OpenCowork → WishfulClaw 全局名称替换（56 前端文件 87 处 + 49 C# 文件 55 处）
- AGENTS.md 重写为 7 层架构（Contracts → Core → Infrastructure → Workspace → Persona → Agent → Worker）

### v2-iter-3 分支上的额外工作：DeepSeek 缓存命中率深度修复

v2-iter-2 标记完成后，在 `dev/v2-iter-3` 分支上继续修复了 DeepSeek prefix cache 命中率问题（从 40%-70% 提升到 93%-99%），主要改动：

- **工具定义改为后端解析**：前端不再传递 tools 数组，只发 toolPreset 字符串，AgentLoop 从 ToolModuleState.Registry 获取工具定义（对齐 Reasonix）
- **请求体字段顺序对齐 Reasonix**：model → messages → tools → stream → stream_options → temperature → max_tokens → thinking → reasoning_effort
- **timestamp 注入策略重构**：InjectTimestampPrefix + InjectMemoryUpdatePrefix 合并为 InjectTransientPrefix，timestamp 直接存入会话历史不再每轮 transient 注入
- **thinking 配置前后端打通**：DeepSeek preset bodyParams 从非标准 `enable_thinking:true` 改为官方 `thinking:{type:enabled}`；前端 provider 注入 thinkingEnabled/thinkingConfig/reasoningEffort；后端展平 bodyParams；assistant tool_calls 消息写入 reasoning_content；OpenAIChatProvider 收集 SSE reasoning_content
- **system-reminder 移除**：前端不再调用 buildRuntimeReminder 拼接到用户消息
- **模型选择器 UI 优化**：设置图标改为 Brain 图标 + effort 等级显示
- **工具输出截断**：ToolCallProcessor 添加 16K head+tail 截断策略
- **清理**：删除 scripts/ 下 24 个临时 patch 脚本，移除诊断代码

> commit: `8a454b9`，在 `dev/v2-iter-3` 分支上。

## 当前项目架构（7 层）

```
Contracts (4 文件)     — 纯接口契约
  ↑
Core (19 文件)          — Agent 通用框架（Protocol + Tools）
  ↑
Infrastructure (计划中)  — Db/Storage/Http 基础设施（v2-iter-3 待新建）
  ↑
Workspace (12 文件)     — 记忆系统
  ↑
Persona (9 文件)        — 人格系统
  ↑
Agent (65 文件)         — Agent 运行时（Loop / Provider / Executor / Compression / SubAgent）
  ↑
Worker (101 文件)       — IPC 宿主 + 模块注册 + 工具实现 + Db/Storage（待瘦身至 ~30）
```

## 当前状态

- 当前分支：`dev/v2-iter-3`，最新 commit: `8a454b9`
- main 最新 commit: `030bf41`，tag `v2.2.0`
- v2-iter-3 分支上已完成 DeepSeek 缓存命中率深度修复（未 push）
- v2-iter-3 的正式任务（Infrastructure 层拆分）尚未开始
- TypeScript 编译零错误：`npx tsc --noEmit`
- C# 编译零错误：`dotnet build`（需指定 sln 路径）

## 本次任务：v2-iter-3 Infrastructure 层拆分

详见 `docs/iteration-plan.md` 中 v2-iter-3 定义。

**目标**：新建 `WishfulClaw.Infrastructure` 项目，将 Db/Storage/Http 基础设施从 Worker 和 Agent 下沉，使 Worker 能进一步拆分 Tools 等模块。Worker 文件数从 101 降至 ~30。

**9 个步骤**：

| 步骤 | 内容 |
|------|------|
| 1 | 创建 `WishfulClaw.Infrastructure` 项目，配置 csproj 引用 Contracts + Core |
| 2 | 搬入 Db — `DbClient.cs` + `Entities/` 从 Worker/Modules/Db 迁入 Infrastructure/Db |
| 3 | 搬入 Storage — `ConfigStore.cs` + `ProviderStore.cs` + `JsonFileNodeCache.cs` 从 Worker 迁入 Infrastructure/Storage |
| 4 | 搬入 Http — `WorkerHttpClientFactory.cs` 从 Agent 迁入 Infrastructure/Http |
| 5 | 更新引用关系 — Agent 引用 Infrastructure；Worker 引用 Infrastructure |
| 6 | Worker 模块瘦身 — 将 FileTools / SearchTools / ShellTools / Providers 等工具实现迁出 Worker |
| 7 | 更新 sln 引用关系，确保分层依赖正确 |
| 8 | 双编译验证：`dotnet build` + `npx tsc --noEmit -p tsconfig.web.json` 零错误 |
| 9 | 功能回归验证 — 核心对话 + 工具调用 + 记忆 + 人格 + DB 读写全链路不回归 |

**后续迭代**（v2-iter-4 ~ v2-iter-9）：Skill 测试 → 渠道测试 → SSH 测试 → 工作台模式 → 全局模式 → Goal 模式。

## 关键技术备忘

- **编译验证命令**：C# `dotnet build src/runtime/WishfulClaw.sln`（可加 `-o` 临时路径避免文件锁定）；TypeScript `npx tsc --noEmit`（或 `npx tsc --noEmit -p tsconfig.web.json`）
- **TS 零报错规则**：每次写完代码必须跑 tsc 验证，不允许用 @ts-ignore 偷懒（可选依赖 mammoth/react-pdf/xlsx 除外）
- **Git push 需要代理**：`git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin <branch>`
- **分支管理规则**：新分支必须从最新 main 拆出，前一个迭代分支必须已合并 main 并打 tag。标准流程：`git checkout main → git pull → git checkout -b dev/v2-iter-N → 开发 → commit → push → 合并 main → 打 tag → 删除分支`
- **日志路径**：`%AppData%/WishfulClaw/logs/`
- **DB 路径**：`%USERPROFILE%/.wishful-claw/index.db`
- **先搬过来适配跑通，再按 AGENTS.md 拆分代码，不要边搬边拆**
- **工作不容易推进时，优先保量再保质**
- **C# 文件多为 CRLF 行尾**，批量替换时注意用 Python 脚本处理，file 工具的 edit 容易因行尾不匹配失败

## Git 工作流

- 当前已在 `dev/v2-iter-3` 分支上，缓存修复代码已 commit（`8a454b9`），未 push
- **功能单元测试通过后才 commit**，不要改一点就提交
- Plan 执行期间只 commit 不 push，Plan 完成后才 push
- 迭代是否完结由用户确认，Agent 不得自行合并 main / 打 tag / 删分支
- Push 需要代理：`git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin dev/v2-iter-3`

## 代码规范

- 大文件 200~500 行为宜，超 500 行必须拆（AGENTS.md 规则）
- C# 用 partial class，TypeScript 用 export/import 模块化
- 逻辑不相关的代码不放在同一个文件
- 拆分后必须 `tsc --noEmit` + `dotnet build` 双编译验证
- C# 文件名 PascalCase，TypeScript 文件名 kebab-case
- 接口前缀 `I`（C# 遵循 .NET 惯例）

## 会话开始时请先执行

1. `git status` + `git log --oneline -5` — 确认当前在 `dev/v2-iter-3`，commit `8a454b9`
2. 读 `AGENTS.md` — 查看 7 层架构和分层约定
3. 读 `docs/iteration-plan.md` — 查看 v2-iter-3 定义和后续迭代计划
4. 先探索当前 Worker 项目的 Db/Storage/Http 依赖链，制定搬迁计划
5. 报告进度摘要，然后开始执行

叫老大，我们是并肩协作的兄弟。
