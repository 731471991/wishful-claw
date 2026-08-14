# v2-iter-13 候选需求分析

> 来源：`D:\koda\Obsidian\02-AI教学\wishfulclaw` 知识库（更新于 2026-08-14）+ GPT-5.6 Sol 适配排查
> 当前状态：v2-iter-12 已完成，产品版本 0.2.12，tag v0.2.12，main 分支

## 候选需求清单（共 8 项）

| # | 类型 | 模块 | 描述 | 复杂度 | 预估工作量 | 状态 |
|---|------|------|------|--------|-----------|------|
| 1 | 缺陷 | 右侧面板文件树 | 右键删除文档报错 | ★☆☆☆☆ | 0.5~1 天 | ✅ 已修复 |
| 2 | 改进 | 聊天窗折叠统计 | 查看/编辑同文件应去重合并 | ★☆☆☆☆ | 0.5 天 | ✅ 已修复 |
| 3 | 改进 | 左侧项目列表 | "更改工作文件夹"改为"打开工作文件夹" | ★☆☆☆☆ | 0.5 天 | ✅ 已修复 |
| 4 | 改进 | 输入框 | 底部统计状态显示移到输入框内部左上角 | ★★☆☆☆ | 0.5~1 天 | ✅ 已修复 |
| 5 | 改进 | 右侧面板文件树 | 加载时显示 `.` 开头的隐藏文件 | ★★☆☆☆ | 0.5 天 | ✅ 已修复 |
| 6 | 改进 | 右侧面板文件树 | 缺少搜索、刷新等操作按钮 | ★★★☆☆ | 1~2 天 | ✅ 已修复 |
| 7 | 改进 | Goal 右侧面板 | 编排记录可视化——自动编排过程记库，面板可查看每轮计划及执行详情 | ★★★★★ | 3~5 天 | 🟡 待优化（未纳入本次迭代） |
| 8 | 功能 | Provider | Responses API Provider 迁移——支持 GPT-5.6 Sol 等 openai-responses 协议模型 | ★★★☆☆ | 1~2 天 | 🆕 本次新增 |

---

## 已完成项（#1~#6，v2-iter-13 体验优化六连修）

> 6 项 UI 层修复和改进已全部完成，详见知识库 issues 回写。

---

## 本次迭代新增项（#8）

### #8 Responses API Provider 迁移

- **背景**：用户购买了 GPT-5.6 Sol coding plan（月付 200），通过 routin.ai 套餐端点 `https://api.routin.ai/plan/v1` 使用。但 WishfulClaw 后端只支持 `openai-chat`（拼 `/chat/completions`）和 `anthropic`（拼 `/v1/messages`）两种协议，不支持 `openai-responses` 协议（拼 `/responses` 端点）。
- **根因**：GPT-5.6 Sol 在 OpenCowork 中定义为 `type: 'openai-responses'`，走 Responses API（`{baseUrl}/responses`），WishfulClaw 完全未迁移此 Provider。
- **现状**：用户填自定义服务商 base URL `https://api.routin.ai/plan/v1`，WishfulClaw 走 `openai-chat` → 拼 `/chat/completions` → routin.ai 套餐端点对 GPT-5.6 Sol 返回 404。
- **改动**：
  - 从 OpenCowork 迁移 `AgentRuntimeOpenAIResponsesProvider` + 相关文件（8 个文件）
  - AgentLoop provider type 白名单加入 `openai-responses`
  - ProviderTestService 连通性测试支持 `openai-responses`
  - ContextCompression 上下文压缩支持 `openai-responses`
  - 前端模型 type 支持 `openai-responses`
- **涉及层**：Agent（Provider 迁移 + AgentLoop + ContextCompression）+ 前端（模型类型支持）
- **OpenCowork 源文件**（8 个）：
  - `AgentRuntimeOpenAIResponsesProvider.cs` — 主 Provider，HTTP SSE + WebSocket 双通道
  - `AgentRuntimeOpenAIResponsesEventParser.cs` — Responses API 事件解析
  - `AgentRuntimeOpenAIResponsesInputWriter.cs` — 输入写入器
  - `AgentRuntimeOpenAIResponsesState.cs` — 状态管理
  - `AgentRuntimeOpenAIResponsesTransport.cs` — 传输层（WebSocket + HTTP SSE）
  - `AgentRuntimeOpenAIResponsesComputerUse.cs` — Computer Use 支持
  - `AgentRuntimeOpenAIResponsesImageGeneration.cs` — 图片生成
  - `AgentRuntimeContextCompression.cs` — 上下文压缩（需适配 responses 分支）
- **预估**：1~2 天
- **验证标准**：
  1. 编译通过（C# 0 错误，TypeScript 3/3 配置 0 错误）
  2. 自定义服务商填 `https://api.routin.ai/plan/v1` + API Key + 模型 `gpt-5.6-sol` + type `openai-responses`
  3. 连通性测试通过
  4. 发消息能流式回复，thinking 正常展示
  5. 工具调用正常

---

## 未纳入本次迭代项（#7）

### #7 Goal 编排记录可视化

- **原因**：需建表+后端+前端，3~5 天，复杂度高
- **状态**：留待后续迭代
