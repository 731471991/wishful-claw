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
3. `docs/plans/iter-11/plan.md` — 迭代十一计划文档
4. `docs/sub-agent-architecture.md` — **本次任务的核心文档**，子 Agent 架构设计方案

## 参考源码位置（笔记本实际路径）

- OpenCowork：`D:\claw\OpenCowork`（Agent Loop / 工具链 / Provider / 前端 UI）
- KodaClaw：`D:\claw\koda-claw`（记忆 / 人格设计思路）
- OpenClaw.net：`D:\claw\openclaw.net`（记忆主动回忆 / 上下文预算）

## 当前状态

- 迭代一~八已完成，代码已合并到 `main`（main 最新 commit: `e04aa28`）
- 当前分支 `dev/iter-11`，已有 **447 个 commit**（尚未合并 main）
- 最新 commit: `3a02f5a`（fix: create_goal/update_goal schema param name + Edit/Write file flush）
- dev/iter-11 已 push 到 origin

## 本次任务：子 Agent 架构实现

**完整方案见 `docs/sub-agent-architecture.md`，必须先读这个文档再动手。**

核心目标：将工具执行从主会话迁移到子 Agent 模式。主 Agent 像产品经理发任务，子 Agent 像程序员执行，执行结束后主 Agent 必须知道做了什么（不能一问三不知）。

### 五个实施阶段（按顺序执行，每阶段独立 commit）

| 阶段 | 内容 | 修改范围 |
|------|------|---------|
| 1 | Worker 事件转发 | `SubAgentExecutor.cs` + `SubAgentRunCollector.cs`，将子 Agent 事件包装为 `sub_agent_*` 前缀转发到父 stream |
| 2 | 主会话上下文保持 | `SubAgentRunCollector.cs` 收集工具调用摘要，`SubAgentExecutor.cs` 拼接进 tool_result；强化子 Agent 报告要求 |
| 3 | 前端步骤描述 | `SubAgentCard.tsx` 改造，执行中展开显示中文步骤，结束后折叠为汇总 |
| 4 | 审批交互 | SubAgentCard 步骤列表中渲染审批按钮，通过 IPC 发送到 Worker |
| 5 | 系统提示词引导 | 调整主 Agent 系统提示词，多步骤任务引导创建子 Agent |

### 关键设计约束

- 子 Agent 事件不能直接透传，必须加 `sub_agent_` 前缀包装
- `SuppressTransportEvents = true` 保持不变
- 简短描述用**中文**自动从工具调用生成（如 `Read("agents.md")` → "查看 agents.md 文件"）
- 审批 UI 在**聊天左侧**（SubAgentCard 展开区域内）
- 右侧面板直接复用现有 `SubAgentsPanel` + `SubAgentExecutionDetail`
- 通过系统提示词引导，不硬性拦截直接工具调用
- 一个主会话同时只有一个运行中的子 Agent

### 已有基础设施（无需新建，只需打通）

wishful-claw 已有完整的子 Agent 基础设施，但**子 Agent 事件被完全抑制**（`SuppressTransportEvents = true`），前端 store 中 `sub_agent_tool_call`、`sub_agent_text_delta`、`sub_agent_iteration` 等处理器从未被触发过。第一阶段的本质就是打通这条事件通道。

已有组件清单：
- Worker: `SubAgentExecutor.cs`、`SubAgentRunCollector.cs`、`ToolCallProcessor.cs`
- Store: `sub-agent-slice.ts`（8 种事件处理）、`adapt-sub-agent-event.ts`
- UI: `SubAgentCard.tsx`（需改造）、`SubAgentsPanel.tsx`（直接复用）、`SubAgentExecutionDetail.tsx`（直接复用）
- 数据: `sub-agent-run-data.ts`（历史合并、过滤、摘要）

## 已完成的基础设施（迭代一~八，已合并 main）

- Electron + React 前端 + .NET 10 后端 + MessagePack IPC 通信全链路打通
- Provider 配置（28 个预设 + CRUD + 连通性测试 + 模型拉取）
- Agent Loop（流式对话 + 取消 + 上下文压缩 + 工具调用循环）
- 工具链（7 个基础工具 + 工具调用 UI）
- 项目注册 + 会话历史（SQLite 持久化，实时写入）
- 人格系统（6 套 24 个预设 + PromptBuilder + 会话级切换 + AI 辅助创建）
- 记忆系统（三层 Hot/Warm/Cold + FTS5 全文搜索 + TryInjectRecall 主动回忆 + 记忆工具）
- 集成验证（全链路修复 + 日志系统 + Worker 防崩溃）
- 提示词优化器（从 OpenCowork 移植，弹窗式 3 选项）
- 子 Agent（Task 工具 + SubAgentExecutor + 事件流 + 前端 SubAgentCard/OrchestrationBlock + 并发上限双信号量 + 超限反馈）
- 前端布局完整搬自 OpenCowork（NavRail + WorkspaceSidebar + TitleBar + SessionConversationPane）

## 迭代十一已完成的工作（dev/iter-11 分支，447 commits）

Plan 11-1~11-5 全部完成：
- **11-1 右侧面板 Tab 系统重构**：RightPanel 重写为动态 tab 系统
- **11-2 SubAgentsPanel**：子 Agent 编排面板（列表 + 详情），子 Agent 历史持久化
- **11-3 BrowserPanel**：内置浏览器面板，browser-access 完整版
- **11-4 PreviewPanel**：文件预览面板，多格式查看器
- **11-5 AgentFilesPanel + SessionChangeReviewPanel**：文件树浏览 + Agent 变更审查面板

工具链大幅扩展：Git 工具、浏览器工具、桌面控制工具、Terminal、WebSearch + WebFetch、AskUserQuestion、MCP 客户端集成、Extension 运行时、Seedance + xAI 视频生成

Channel 系统：8 个渠道（飞书/微信/钉钉/企业微信/QQ/Telegram/Discord/WhatsApp）

本轮 Bug 修复（本次会话之前的最近 commits）：
- isStreaming 持久化导致 agent 历史丢失（`6b63330`）
- retry banner 清除时机 + 闪烁修复，改为白名单清除（`7f55b39` → `ac65f5d`）
- retry banner 中文翻译（`a264ece`）
- 工具卡片全部渲染导致卡死，改为只命令工具展开 + 并发 8→3（`a66052b`）
- 所有特殊工具卡片 streaming 时自动展开修复（`9429e68`）
- create_goal 参数名不匹配修复（`3a02f5a`）
- Edit→Read 缓存一致性，添加 WriteAndFlushAsync（`3a02f5a`）

大规模代码拆分：已拆分 30+ 个超 500 行文件，仍剩 30 个待拆

## 迭代十一尚未完成的其他事项

1. **代码拆分继续**：剩余 30 个文件超 500 行
2. **agent:changes 后端记录**：Plan 11-5 中 Agent 变更审查的后端持久化
3. **迭代验证 + 合并 main**：dev/iter-11 有 447 commits 尚未合并 main，需用户确认后合并、打 tag v0.11.0
4. **清理临时脚本**：项目根目录有 patch_*.py 临时文件待清理

## Git 工作流

- 当前在 `dev/iter-11` 分支
- **功能单元测试通过后才 commit**，不要改一点就提交。中间反复修改不产生 commit
- 每个实施阶段完成后独立 commit，便于回滚
- Git push 需要代理：`git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin dev/iter-11`

## 特别注意

- 从 OpenCowork 搬代码时必须适配项目命名空间（`WishfulClaw.*`）和分层约定
- 大文件搬入时按职责拆分（AGENTS.md：200~500 行为宜，超 500 行必须拆，C# 用 partial class，TS 用 export/import 模块化）
- 拆分后必须 `tsc --noEmit` + `dotnet build` 双编译验证
- 迭代是否完结由用户确认，Agent 不得自行合并 main / 打 tag / 删分支

## 会话开始时请先执行

1. `git status` + `git log --oneline -10` — 定位当前进度
2. 读 `docs/sub-agent-architecture.md` — **本次任务的核心文档**
3. 读 `docs/plans/iter-11/plan.md` — 确认 Plan 和步骤
4. 报告进度摘要，然后从子 Agent 架构实施阶段 1 开始执行

叫老大，我们是并肩协作的兄弟。
