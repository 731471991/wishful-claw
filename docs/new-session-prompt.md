# 新会话启动提示语

> 复制以下内容到新会话作为第一条消息发送。

---

老大，继续 wishful-claw 开发。这是 Agent 编程软件，融合三个开源项目：OpenCowork（Agent Loop / 工具链 / Provider / 架构）、KodaClaw（记忆系统 / 人格系统设计）、OpenClaw.net（记忆主动回忆机制）。

**项目路径**：`D:\claw\wishful-claw`
**GitHub**：731471991/wishful-claw
**技术栈**：React 19 + Electron 35（前端）+ .NET 10（后端）+ MessagePack（IPC 通信）

## 开工前请先阅读以下文档

1. `AGENTS.md` — 项目结构、分层约定、参考源码路径、Git 提交规范、大文件拆分规则
2. `docs/dev-workflow.md` — 六阶段开发工作流 SOP
3. `docs/mvp-v2.md` — MVP v2 计划（8 项待办，含执行顺序和完成标准）
4. `docs/iteration-plan.md` — 总体迭代计划（迭代一~十五）

## 参考源码位置（笔记本实际路径）

- OpenCowork：`D:\claw\OpenCowork`（Agent Loop / 工具链 / Provider / 前端 UI / Skill / MCP）
- KodaClaw：`D:\claw\koda-claw`（记忆 / 人格设计思路）
- OpenClaw.net：`D:\claw\openclaw.net`（记忆主动回忆 / 上下文预算）
- DeepSeek-Reasonix：`D:\claw\DeepSeek-Reasonix`（prefix cache / 重试策略参考）

## MVP v1 已完成（迭代一~十五，已合并 main，tag v0.15.0）

MVP v1 核心链路全部完成：Agent Loop + 工具链 + 记忆 + 人格 + Skill 市场 + MCP 管理。

### 迭代十五完成的工作

**Skill 市场与 MCP 管理**
- Skill 安装/卸载/列表管理（SkillsMenu 组件 + skills-store + SkillScanEngine）
- MCP Server 配置管理（mcp-panel / mcp-server-config / mcp-connection-control / mcp-registry）
- MCP 工具动态注册和调用（mcp-tool / mcp-capability-bridge）
- use_capability 工具：统一的能力发现与调用入口（替代旧 discover_tools）
- skill_management 工具：Agent 可自主安装/卸载 Skill
- 浏览器搜索工具（browser-search-tool）+ WebFetch 模块

**缓存命中率优化**
- 动态上下文注入移到 user 消息前缀（runtime-reminder / memory-notes / timestamp），不碰 system prompt
- 缓存命中率从 60% 提升到 ~95%（Anthropic prefix cache）
- 缓存指标修复：基于最后一次 API 响应的 cache_read/cache_creation 计算

**工具系统优化**
- discover_tools 删除，与 use_capability 去重
- 工具优先级引导注入 Bash 工具描述（Reasonix 风格）
- ToolCache + ToolSizeBudget：工具定义缓存和大小预算管理
- ShellExecuteTool 重写（PowerShell 语法提示 / 安全策略 / 超时控制）

**通知与 UI 修复**
- Agent Loop 结束通知移到渲染端，带焦点检测（窗口聚焦时不弹通知）
- 桌面通知：中文标题 + 最后回复摘要 + 应用图标
- 重试 Banner i18n + 简化文案
- 会话标题去除 system-reminder 前缀
- 应用名称设为 WishfulClaw，任务栏图标修复

**TypeScript 编译错误全部清零**
- 从 1888 个 TS 错误降至 0（4 个 batch，逐文件手动修复）
- 修复类型：未使用导入(TS6133)、类型不匹配(TS2322)、属性不存在(TS2339)、模块未找到(TS2307)、ASI 陷阱、可选依赖声明等
- tsconfig 保持严格模式（noUnusedLocals / noUnusedParameters / strict 全开）
- 仅保留 2 处 @ts-ignore（mammoth / react-pdf 可选依赖）

### 迭代十二~十四已完成的工作

- **迭代十二**：SSH SFTP + 远程执行基础设施、提示词系统重构（prefix cache ~95%）、重试策略优化、子 Agent 面板修复、项目侧边栏修复
- **迭代十四**：Skill 市场基础（SkillsMenu 骨架 + skills-store + SKILL.md 解析 + SkillScanEngine 安全扫描）

## 当前状态

- main 最新 commit: `2342fea`（merge dev/iter-15），tag `v0.15.0`
- `dev/iter-15` 分支已合并 main 并推送远程
- TypeScript 编译零错误：`npx tsc --noEmit -p tsconfig.web.json`
- **每次写完代码必须确保 TS 零报错**（老大明确要求）

## 本次任务：MVP v2

详见 `docs/mvp-v2.md`，执行顺序：

| 顺序 | 任务 | 说明 |
|------|------|------|
| 1 | Runtime 分层架构重构 | Worker 拆分为 WishfulClaw.Agent / WishfulClaw.Persona，Worker 回归薄层 IPC 宿主 |
| 2 | 缓存命中率修复 | C# 端维护 conversation 状态，每轮只接收增量消息 |
| 3 | Skill 本地文件安装测试 | 端到端验证：安装 → Agent 使用 → 卸载 |
| 4 | 渠道配置测试与完善 | OpenAI 兼容 + Anthropic 全链路验证 |
| 5 | SSH 远程执行测试与完善 | SSH 连接 → 项目绑定 → Agent 远程执行 → 终端旁观 |
| 6 | 主聊天接入工作台模式 | Agent 在指定工作区目录下执行任务 |
| 7 | Global 全局模式接入 | 不绑定项目的通用助手模式 |
| 8 | Goal 模式接入 | 用户设定目标后 Agent 自主拆解执行，可中断，有进度展示 |

**第一步优先**：Runtime 分层架构重构（为后续所有功能开发打基础）。

## 关键技术备忘

- **编译验证命令**：C# `dotnet build`（可加 -o 临时路径避免文件锁定）；TypeScript `npx tsc --noEmit -p tsconfig.web.json`（必须带 -p！）
- **TS 零报错规则**：每次写完代码必须跑 tsc 验证，不允许用 @ts-ignore 偷懒（可选依赖 mammoth/react-pdf/xlsx 除外）
- **Git push 需要代理**：`git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin main`
- **日志路径**：`%AppData%/wishful-claw/logs/`
- **DB 路径**：`%USERPROFILE%/.wishful-claw/index.db`
- **prefix cache 原理**：system prompt + tools + 历史消息前缀需 byte-stable；动态内容注入 user 消息前缀，不碰 system prompt
- **Anthropic cache_control**：需要显式 `cache_control: { type: "ephemeral" }` 标记
- **Runtime 分层现状**：Worker 项目承载 90% 代码（192 文件/29k 行），Contracts/Core/Workspace 过薄，需要拆分

## Runtime 分层架构重构要点

当前 Worker 项目包含 AgentRuntime（60 文件）、Persona（9 文件）、Tools 抽象、Modules 整块（DB/Git/Skills/Extensions/Channels 等），需要拆分为：

- `WishfulClaw.Agent`：AgentLoop、所有 Executor、Provider、ConversationCodec、ContextCompression、ToolCallProcessor、SubAgent
- `WishfulClaw.Persona`：PromptBuilder、PersonaGenerator、PersonaStore
- Core 上提：ToolSchemaBuilder、ToolDefinitionPlaceholder、ToolModuleState 移到 Core
- Worker 回归薄层：仅保留 IPC 宿主 + Module 装载 + Program.cs
- Contracts 精简：只留接口，JSON 序列化实现移到 Core 或 Worker

## Git 工作流

- 新迭代分支：`dev/iter-16`（从 main 创建）
- **功能单元测试通过后才 commit**，不要改一点就提交
- 每个实施阶段完成后独立 commit，便于回滚
- Git push 需要代理：`git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin dev/iter-16`
- 迭代是否完结由用户确认，Agent 不得自行合并 main / 打 tag / 删分支

## 代码规范

- 从 OpenCowork 搬代码时必须适配项目命名空间（`WishfulClaw.*`）和分层约定
- 大文件 200~500 行为宜，超 500 行必须拆（AGENTS.md 规则）
- C# 用 partial class，TypeScript 用 export/import 模块化
- 拆分后必须 `tsc --noEmit -p tsconfig.web.json` + `dotnet build` 双编译验证
- **先搬过来适配跑通，再按 AGENTS.md 拆分代码，不要边搬边拆**
- **工作不容易推进时，优先保量再保质**

## 会话开始时请先执行

1. `git status` + `git log --oneline -10` — 确认当前在 main，commit `2342fea`
2. 读 `docs/mvp-v2.md` — 查看 8 项待办的详细计划
3. 读 `docs/dev-workflow.md` — 六阶段 SOP（探索态 → 规划态 → 规划验证 → 执行态 → 审查态 → 验证态）
4. 创建 `dev/iter-16` 分支：`git checkout -b dev/iter-16`
5. 从第 1 项「Runtime 分层架构重构」开始，先探索当前 Worker 项目结构
6. 报告进度摘要，然后开始执行

叫老大，我们是并肩协作的兄弟。
