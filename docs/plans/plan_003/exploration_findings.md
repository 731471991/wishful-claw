# 迭代三探索报告：Agent Loop + 对话

## 探索日期
2026-07-21

## 三个参考项目的 Agent Loop 设计对比

### OpenCowork — 执行引擎（主要搬入来源）

**架构特点**：
- 单文件巨型 Loop（OpenAIChatRuntime.cs 3828 行），包含一切
- 后台 Task.Run 执行，通过流式事件推送进度
- Provider 直接内嵌在 Loop 文件中（按 type 分支调用）
- 流式事件通过 MessagePack 二进制帧推送到前端
- 工具执行器（Executor 模式）在 Loop 内调用

**优点**：流式协议成熟、Provider 支持全、SSE 解析经过验证
**缺点**：单文件太重、Loop 和 Provider 耦合、事件类型扁平混乱（50+ 字段的 record）

### KodaClaw — 分层架构 + 事件总线（参考设计思路）

**架构特点**：
- Agent 类用 partial 拆分（Chat / Processing / Step / Lifecycle / ModelStreaming / Skills / SubAgent）
- **三通道事件总线**（EventBus）：Progress（UI 流式）/ Control（审批流程）/ Monitor（可观测性）
- **StepAsync 是核心循环体**：单步 = 一次模型调用 + 工具执行
- **ContextManager** 独立管理上下文压缩：分析 → 压缩 → 摘要栈 + 核心记忆块
- **PromptBuilder** 分段组装 System Prompt（Profile + Overlay + Context Documents + 字符预算）
- **HookManager** 在关键节点介入（PreModel / PostModel / MessagesChanged / PreToolUse / PostToolUse）
- 状态机：Ready → Working → Paused（等审批）→ Ready
- 消息队列：用户消息入队 → EnsureProcessing → 后台循环消费
- 循环检测：工具调用指纹去重，3 次重复注入 nudge

**关键设计值得参考**：
1. **三通道事件分离**：Progress 给 UI 流式、Monitor 给日志/诊断、Control 给审批。不是所有事件都往聊天流里塞
2. **ContextManager 独立**：压缩逻辑不混在 Loop 里，独立分析 + 压缩 + 摘要栈
3. **Step 抽象**：单步 = 一次模型调用 + 工具执行，Loop 就是反复 Step
4. **状态机**：Ready/Working/Paused 清晰转换
5. **消息队列**：用户发消息入队，Loop 后台消费，不阻塞 UI
6. **循环检测**：工具调用指纹去重
7. **PromptBuilder**：分段组装 + 字符预算

### OpenClaw.net — 记忆主动回忆 + 上下文预算（参考记忆机制）

**架构特点**：
- AgentRuntime.RunTurnAsync 是主入口
- **TryInjectRecallAsync**：Loop 开始前，用用户消息搜记忆，注入到对话上下文
  - 搜索 IMemoryNoteSearch.SearchNotesAsync(userMessage, prefix, limit)
  - 命中后构建 `[Relevant memory]` 块，插入到 messages[1]
  - 标注 "untrusted data" 防注入
  - 支持 project 前缀搜索 + fallback 全局搜索
- **ContextBudgetPlanner**：基于 token 字符估算的上下文预算
  - maxChars = min(request, tokenEstimate, config) 
  - 超预算时截断 + 标记 truncated
- **CircuitBreaker**：LLM 调用熔断器
- **Session 预算**：session 级别 token 预算控制
- **Checkpoint/Resume**：可恢复的执行检查点

**关键设计值得参考**：
1. **记忆主动回忆**：Loop 开始前自动搜记忆注入，不需要 Agent 主动调工具
2. **上下文预算**：不只是压缩，而是预算管理（token 字符估算）
3. **不可信数据标注**：注入的记忆标注为 untrusted，防注入

## 灵犀自身使用方式参考

老大要求参考灵犀本身的工作模式：
- **左侧是聊天**：对话交互
- **右侧悬浮窗**：记录进度，显示修改/编辑/新增的文件、执行的脚本等操作记录
- **不把所有东西塞聊天流**：工具调用结果、文件操作、脚本执行等放进活动面板，聊天流只保留对话文本

这意味着事件分流：
- **聊天流事件**：text_delta, thinking_delta, message_end, loop_start/end, error
- **活动面板事件**：tool_call_start, tool_call_result, file_change, script_execution, iteration_start/end, context_compression

## 当前项目已有基础设施

- IPC 通信：Named Pipe + MessagePack 帧协议
- Worker 模块系统：IWorkerModule + WorkerModuleCatalog
- WorkerRequestContext：支持 EmitEventAsync + EmitMessagePackEventAsync
- Provider 管理：28 个预设 + CRUD + 测试 + 模型拉取
- 前端 Store：Zustand + persist

### 关键缺口
1. native-worker.ts 不处理事件帧（只处理 response）
2. 无 Agent Loop
3. 无流式协议
4. 无聊天 UI

## wishful-claw Agent Loop 设计方案

### 核心原则
1. **Loop 结构参考 KodaClaw 的 Step 模式**：Loop = 反复 StepAsync，每步 = 一次模型调用 + 可选工具执行
2. **事件通道参考 KodaClaw 三通道**：Progress（聊天流）/ Activity（活动面板）/ Monitor（日志）
3. **Provider 搬 OpenCowork 的实现**：SSE 解析成熟，直接搬入
4. **记忆注入参考 OpenClaw.net**：Loop 前自动搜记忆注入（迭代六实现，迭代三预留接口）
5. **上下文管理参考 KodaClaw ContextManager**：独立组件，不混在 Loop 里
6. **UI 参考灵犀**：左聊天 + 右活动面板

### 事件分流设计

| 事件类型 | 目标 | 内容 |
|----------|------|------|
| text_delta | 聊天流 | 模型回复文本增量 |
| thinking_delta | 聊天流 | 思考过程增量 |
| message_end | 聊天流 | 消息完成（usage, timing） |
| loop_start/end | 聊天流 | 对话开始/结束 |
| error | 聊天流 | 错误信息 |
| iteration_start/end | 活动面板 | 迭代进度 |
| tool_call_start/result | 活动面板 | 工具调用状态 |
| context_compression_* | 活动面板 | 上下文压缩 |
| request_debug | 活动面板 | 请求调试信息 |

### UI 布局

```
┌─────────────────────────────────────────────────┐
│  自定义标题栏 (已有)                              │
├──────────────────────┬──────────────────────────┤
│                      │                          │
│   聊天区域            │   活动面板 (悬浮/可折叠)   │
│                      │                          │
│   - 消息列表          │   - 迭代进度              │
│   - 流式渲染          │   - 工具调用记录           │
│   - 思考折叠          │   - 文件变更              │
│                      │   - 脚本执行              │
│                      │   - 上下文压缩            │
│                      │                          │
├──────────────────────┤                          │
│   输入区域            │                          │
│   - 文本框            │                          │
│   - 模型选择          │                          │
│   - 发送/取消         │                          │
└──────────────────────┴──────────────────────────┘
```
