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
3. `docs/plans/iter-12/plan.md` — 迭代十二计划文档
4. `docs/smoke-test-checklist.md` — 冒烟测试清单（含本轮修复记录）
5. `docs/sub-agent-architecture.md` — 子 Agent 架构设计方案

## 参考源码位置（笔记本实际路径）

- OpenCowork：`D:\claw\OpenCowork`（Agent Loop / 工具链 / Provider / 前端 UI）
- KodaClaw：`D:\claw\koda-claw`（记忆 / 人格设计思路）
- OpenClaw.net：`D:\claw\openclaw.net`（记忆主动回忆 / 上下文预算）
- DeepSeek-Reasonix：`D:\claw\DeepSeek-Reasonix`（prefix cache / 重试策略参考）

## 当前状态

- 迭代一~八已完成，代码已合并到 `main`（main 最新 commit: `e04aa28`）
- 当前分支 `dev/iter-12`，已 push 到 origin
- 最新 commit: `61f6ff3`（feat: prefix cache optimization, retry strategy, sub-agent panel fixes, prompt optimizer fix）

## 迭代十二已完成的工作

### SSH SFTP + 远程执行基础设施
- SSH 连接管理（connection-manager / auth / repository）
- DB 建表 `ssh_connections` + CRUD
- Main 进程 SSH IPC 注册（ssh:connection:list/create/update/delete + ssh:exec）
- AgentRuntimeSshToolExecutor 精简版
- 密码用 safeStorage 加密存储

### 提示词系统重构
- PromptBuilder 重构：personaId + workingFolder + language + userRules + sshConnectionId
- 系统提示词缓存（SystemPromptCache）：按 (personaId, workingFolder, language, userRules, sshConnectionId) 缓存
- 时间戳注入走 user 消息前缀（不碰 system prompt），保护缓存命中率
- Anthropic cache_control 显式断点 + tool 列表按 name 排序（字节稳定）
- OpenAI tool 列表同样按 name 排序
- Memory 写入后清 SystemPromptCache
- prefix cache 命中率从 60% 提升到 ~95%

### 重试策略优化
- ProviderRetryPolicy 重写：指数退避（500ms*2^n）+ jitter（0-250ms）+ 封顶 15s + Retry-After 优先
- 解决级联 429 导致节点切换 cache miss

### 子 Agent 面板修复
- LEGACY_SUMMARY_PREFIXES 导出修复
- SubAgentCard：hasSteps 检查 histMeta、effectiveToolCalls 回退历史数据、panelTitle 用 description
- SubAgentsPanel：移除 SubAgentDetailHeader（返回按钮）、fallback 分支渲染历史子 agent
- RightPanel：移除 subagent tab title 强制覆盖
- ui-store：ensureSubAgentTab 用 title 参数、closeRightPanelTab 关闭最后 tab 时收起面板
- openAgent 传 description 作为标题

### 项目侧边栏修复
- 重启后自动展开活跃项目（useRef 一次性 useEffect）
- 移除项目标题点击跳转 chathomepage（会话切换必须点击具体会话）
- setActiveProjectHome 不再清除 activeSessionId

### 提示词优化器修复
- toPermissionPolicySnapshot 导入修复（白屏）
- canSidecarHandle 导入修复（请求发不出）
- 弹窗 UI i18n 中文化
- 复用 getActiveProvider() + activeModelId 替代手动挑 fast model（404 根因）
- error 事件转发（不再静默吞掉）

### tsc 编译验证机制修正
- 发现 `npx tsc --noEmit` 不带 `-p` 是假编译（只走 references 不检查文件内容）
- 正确命令：`npx tsc --noEmit -p tsconfig.web.json`
- 清理本次修改引入的未使用导入（ArrowLeft / ipcClient / navigateToProject）

### 其它
- 文件树面板修复（useShallow 无限循环、fs:list-dir 格式、图片 base64 预览）
- 工具 InputSchema 序列化修复（10 个工具文件 `=>` 改 `{ get; } =`）
- ToolModule 工具 category 修复
- 取消后消息丢失修复（cancelStream 持久化）
- 会话时间显示优化（跨天"昨天 HH:MM"、中文化、常驻显示）

## 迭代十二尚未完成的事项

1. **SSH + 终端面板测试**（Plan 12-2 ~ 12-4 的验证）：SSH 远程执行、终端旁观模式、SSH 连接管理 UI 尚未冒烟测试
2. **冒烟测试剩余项**：子 Agent（34-37）、记忆系统（25-29）、稳定性观察（49-52）尚未测试
3. **代码拆分继续**：仍有 30+ 个文件超 500 行
4. **agent:changes 后端记录**：Plan 11-5 中 Agent 变更审查的后端持久化
5. **迭代验证 + 合并 main**：dev/iter-12 尚未合并 main，需用户确认后合并、打 tag v0.12.0
6. **后续迭代 13~15**（聊天窗渲染 / Skill 市场 / MCP 管理）冻结，优先稳定性

## 关键技术备忘

- **正确的编译验证命令**：C# `dotnet build`（可加 -o 临时路径避免文件锁定）；TypeScript `npx tsc --noEmit -p tsconfig.web.json`（必须带 -p！）
- **Git push 需要代理**：`git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin dev/iter-12`
- **日志路径**：`%AppData%/wishful-claw/logs/`
- **DB 路径**：`%USERPROFILE%/.wishful-claw/index.db`
- **prefix cache 原理**：system prompt + tools + 历史消息前缀需稳定；DeepSeek cache 是节点本地的，429 重试路由到不同节点会 cache miss
- **Anthropic cache_control**：需要显式 `cache_control: { type: "ephemeral" }` 标记
- **Reasonix 的 transient injection 模式**：动态内容注入 user 消息前缀，不碰 system prompt（本项目已采用此方案）

## Git 工作流

- 当前在 `dev/iter-12` 分支
- **功能单元测试通过后才 commit**，不要改一点就提交。中间反复修改不产生 commit
- 每个实施阶段完成后独立 commit，便于回滚
- Git push 需要代理：`git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin dev/iter-12`

## 特别注意

- 从 OpenCowork 搬代码时必须适配项目命名空间（`WishfulClaw.*`）和分层约定
- 大文件搬入时按职责拆分（AGENTS.md：200~500 行为宜，超 500 行必须拆，C# 用 partial class，TS 用 export/import 模块化）
- 拆分后必须 `tsc --noEmit -p tsconfig.web.json` + `dotnet build` 双编译验证
- 迭代是否完结由用户确认，Agent 不得自行合并 main / 打 tag / 删分支

## 会话开始时请先执行

1. `git status` + `git log --oneline -10` — 定位当前进度
2. 读 `docs/smoke-test-checklist.md` — 查看冒烟测试进度
3. 读 `docs/plans/iter-12/plan.md` — 确认 Plan 和步骤
4. 报告进度摘要，然后按用户指示推进

叫老大，我们是并肩协作的兄弟。
