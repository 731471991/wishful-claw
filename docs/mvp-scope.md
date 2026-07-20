# Wishful Claw MVP 边界

## 第一版目标

桌面应用，核心链路跑通，给自己用。

## 砍掉（第一版不要）

| 砍掉项 | 理由 |
|--------|------|
| 频道接入（钉钉/飞书/QQ/微信等） | 第一版纯桌面，不需要 IM |
| CodeGraph 代码图谱 | 重模块，依赖 Tree-sitter，第一版用不上 |
| Team 多 Agent 协作 | 复杂度高，第一版单 Agent 够用 |
| SubAgent 子 Agent | 同上 |
| 浏览器自动化 | 非核心链路，后面加 |
| 图片生成 / 视频 | 非核心链路 |
| Cron 定时任务 | 非核心链路 |
| SSH 远程执行 | 非核心链路 |
| Docker 沙箱 | 第一版本地执行就行 |
| MCP 协议 | 非核心，后面加 |
| 插件系统 | 非核心，后面加 |
| 技能系统（Skills） | 非核心，后面加 |
| Widget / Desktop 桌面控制 | 非核心 |
| 同步 | 非核心 |

## 保留（第一版必须有）

| 模块 | 具体内容 | 来源 |
|------|---------|------|
| Agent Loop | 循环主体，流式输出，取消，上下文压缩 | OpenCowork |
| Provider | 至少先跑通 1-2 种（openai-chat + anthropic） | OpenCowork |
| 工具链（最小集） | 文件读写、Shell 执行、代码搜索（grep/glob） | OpenCowork |
| 记忆系统 | 文件驱动 + FTS 搜索 + 主动回忆注入 + Agent 工具读写 | KodaClaw + OpenClaw.net |
| 人格系统 | Identity + Soul + PersonaPreset + PromptBuilder | KodaClaw |
| 项目注册 | SQLite 存项目名 + 工作区路径 | 新写 |
| 会话历史 | SQLite 存对话记录 | OpenCowork |
| UI | 基于 OpenCowork React 前端做减法 + 记忆/人格交互调整 | OpenCowork |

## 前端策略

OpenCowork 的页面本身满意，直接拿来做减法：

- 砍掉频道、CodeGraph、Team、SubAgent、SSH、Widget 等不需要的页面和组件
- 保留对话界面、终端、文件管理、设置等核心页面
- 新增/调整记忆面板（可视化记忆文件、记忆状态）
- 新增/调整人格切换面板
- 调整 System Prompt 构建逻辑从前端移到后端（runtime）

## 第一版跑通标准

```
1. 能创建/切换项目
2. 能跟 Agent 对话，流式输出
3. Agent 能调工具（读写文件、跑命令、搜索代码）
4. 记忆用上了——对话前自动注入相关记忆，Agent 能主动读写记忆
5. 人格体现——不同人格输出风格不同
6. 关掉重开，记忆还在
```
