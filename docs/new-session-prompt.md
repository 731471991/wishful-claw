# 新会话启动提示语

> 复制以下内容到新会话作为第一条消息发送。

---

老大，继续 wishful-claw 开发。这是 Agent 编程软件，融合三个开源项目：OpenCowork（Agent Loop / 工具链 / Provider / 架构）、KodaClaw（记忆系统 / 人格系统设计）、OpenClaw.net（记忆主动回忆机制）。

**项目路径**：`D:\claw\wishful-claw`
**GitHub**：731471991/wishful-claw
**技术栈**：React 19 + Electron 35（前端）+ .NET 10（后端）+ MessagePack（IPC 通信）

**开工前请先阅读以下文档**：
1. `AGENTS.md` — 项目结构、分层约定、参考源码路径、Git 提交规范、大文件拆分规则
2. `docs/dev-workflow.md` — 六阶段开发工作流 SOP
3. `docs/plans/iter-11/plan.md` — 迭代十一计划文档

**参考源码位置**（笔记本实际路径）：
- OpenCowork：`D:\claw\OpenCowork`（Agent Loop / 工具链 / Provider / 前端 UI）
- KodaClaw：`D:\claw\koda-claw`（记忆 / 人格设计思路）
- OpenClaw.net：`D:\claw\openclaw.net`（记忆主动回忆 / 上下文预算）

**当前状态**：
- 迭代一~八已完成，代码已合并到 `main`（main 最新 commit: `e04aa28`）
- 当前分支 `dev/iter-11`，已有 **107 个 commit**（尚未合并 main）
- 最新 commit: `5cbb096`（refactor: split input-renderers and runtime-status）
- dev/iter-11 已 push 到 origin

**已完成的基础设施**（迭代一~八，已合并 main）：
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

**迭代十一已完成的工作**（dev/iter-11 分支，107 commits）：

Plan 11-1~11-5 全部完成：
- **11-1 右侧面板 Tab 系统重构**：RightPanel 重写为动态 tab 系统（拖拽调宽 + 切换动画 + 关闭按钮），RightPanelHeader 动态 tab 条，ui-store 补全浏览器/sub-agent/preview 状态管理，webviewTag 开启
- **11-2 SubAgentsPanel**：子 Agent 编排面板（列表 + 详情），搬入 SubAgentsPanel + SubAgentExecutionDetail + sub-agent-run-data + sub-agent-visuals，子 Agent 历史持久化（SQLite + 按需加载）
- **11-3 BrowserPanel**：内置浏览器面板（webview + 地址栏 + 前进后退刷新），browser-access 完整版（URL 规范化 + 域名白/黑名单），webview 常驻不随 tab 切换销毁，Agent 浏览器工具可驱动同一 webview
- **11-4 PreviewPanel**：文件预览面板，多格式查看器（代码/Markdown/图片/HTML/视频/音频/PDF/SVG/字体/表格），Monaco 编辑器 + 文件监听热更新
- **11-5 AgentFilesPanel + SessionChangeReviewPanel**：文件树浏览 + Agent 变更审查面板，GitPage SCM 面板

工具链大幅扩展（从 OpenCowork 移植）：
- Git 工具（6 个 IPC 通道：状态解析/仓库扫描/查询操作/命令执行/模块注册）
- 浏览器工具（BrowserNavigate/GetContent/Snapshot/Type/Click/Screenshot 注册为 Agent 可调用工具）
- 桌面控制工具（5 个）、Terminal 会话（node-pty）、WebSearch + WebFetch、AskUserQuestion
- MCP 客户端集成（@modelcontextprotocol/sdk 替换 stub）
- Extension 运行时模块（扩展 manifest 管理 + HTTP 工具执行器）
- IToolProvider 模式重构（可扩展工具注册）
- Seedance + xAI 视频生成模块

Channel 系统（从 OpenCowork 移植）：
- 8 个渠道：飞书/微信/钉钉/企业微信/QQ/Telegram/Discord/WhatsApp
- 全局模式（非 per-project），QR 码绑定 UI，IPC handler 完整

Bug 修复和体验优化：
- 流式回复聊天窗抖动修复（rAF 批处理 delta flush）
- 并发工具调用完成后显示散开修复（跳过 tool_result block 不关闭 run 分组）
- WebSearch 设置面板补充（provider 选择 + API Key + 测试按钮）
- Browser panel 激活失败修复（webview src 恢复 + 诊断代码移除）
- 浏览器工具错误处理修复（throw 而非返回 encodeToolError）
- AskUserQuestion 提交按钮不可点击修复
- AgentRuntimeJsonContext CamelCase 缺失修复
- 反幻觉检测注入 + 撤回
- 工具描述截断 + browser 诊断日志
- per-turn 工具调用上限错误返回

大规模代码拆分（按 AGENTS.md 规则）：
- 已拆分 30+ 个超 500 行文件，包括 ExtensionManifestStore.cs(1682→5文件)、FileChangeCard.tsx(1315→4文件)、MessageList.tsx(1321→1155+3子文件)、GitPage.tsx(1190→610+2子文件)、ExtensionToolResultCard.tsx(865→4文件) 等
- 仍剩 30 个文件超 500 行（多为单巨型组件需提取 custom hooks、store 定义需按 slice 拆分、provider preset 数据对象）
- 4 个超 1000 行文件已降到 1 个（MessageList.tsx 1155 行，剩余 scroll 逻辑需提取为 custom hook）

**迭代十一尚未完成的事项**：
1. **代码拆分继续**：剩余 30 个文件超 500 行，优先处理 MessageList.tsx(1155)、InputArea(969)、ModelSwitcher(811)、settings-store(801) 等大文件
2. **agent:changes 后端记录**：Plan 11-5 中 Agent 变更审查的后端持久化（SQLite DAO + 变更快照 + 撤销）标记为后续迭代
3. **迭代验证 + 合并 main**：dev/iter-11 有 107 commits 尚未合并 main，需用户确认后合并、打 tag v0.11.0

**Git 工作流**（AGENTS.md 中有提交规范）：
- 当前在 `dev/iter-11` 分支，已有 107 commits
- **功能单元测试通过后才 commit**，不要改一点就提交。中间反复修改不产生 commit
- Plan 执行期间只 commit 不 push（当前已 push 一次，后续按需 push）
- 迭代验证通过后打 tag `v0.11.0`，合并回 main 并 push（**需用户确认后才执行**）
- Git push 需要代理：`git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin dev/iter-11`

**特别注意**：
- 从 OpenCowork 搬代码时必须适配项目命名空间（`WishfulClaw.*`）和分层约定，清理不需要的功能
- 大文件搬入时按职责拆分（AGENTS.md：200~500 行为宜，超 500 行必须拆，C# 用 partial class，TS 用 export/import 模块化）
- 拆分后必须 `tsc --noEmit` + `dotnet build` 双编译验证
- 迭代是否完结由用户确认，Agent 不得自行合并 main / 打 tag / 删分支

**会话开始时请先执行**（dev-workflow.md 会话边界规则）：
1. `git status` + `git log --oneline -10` — 定位当前进度
2. 读 `docs/plans/iter-11/plan.md` — 确认 Plan 和步骤
3. 报告进度摘要，然后继续执行

叫老大，我们是并肩协作的兄弟。
