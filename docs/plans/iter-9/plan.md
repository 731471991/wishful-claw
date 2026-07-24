# 迭代九：输入框修复 + 提示词优化器

## 目标

修复输入框底部 token 统计全为 0 的问题；实现提示词优化器功能。

## 验证标准

- 提示词优化器：输入框输入文本 → 点击优化按钮 → 看到 1-3 个优化方案 → 选择后替换输入框内容
- Token 统计：对话过程中输入框底部实时显示 input/output token 数量（非全 0）
- AGENTS.md 路径修正：参考项目路径指向笔记本实际路径

## 前置排查结论

### Token 统计问题

已通过实际 API 调用确认：中转商（token.sensenova.cn）在 SSE 流式响应中**确实返回了 usage**，格式为：

```json
{
  "choices": [],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 38,
    "total_tokens": 48,
    "completion_tokens_details": { "reasoning_tokens": 29, ... },
    "prompt_tokens_details": { "cached_tokens": 0, ... }
  }
}
```

后端 `OpenAIChatSseParser.TryReadUsage` 解析逻辑正确：
- `prompt_tokens` → InputTokens ✓
- `completion_tokens` → OutputTokens ✓
- `prompt_tokens_details.cached_tokens` → CacheReadTokens ✓
- `completion_tokens_details.reasoning_tokens` → ReasoningTokens ✓

模拟测试确认 `finalUsage` 被正确赋值，`message_end` 事件会带上 Usage。

**问题定位在前端侧**：从 `message_end` 事件的 `event.usage` 到 `ComposerRuntimeStatus` 显示之间的环节。
对比 Reasonix（Go 源码 `internal/provider/openai/openai.go`）的字段解析完全一致。

### 提示词优化器

`src/renderer/src/lib/prompt-optimizer/optimizer.ts` 当前是空壳 stub：
```ts
export async function* optimizePrompt(...): AsyncGenerator<...> {
  // TODO: implement prompt optimization
  yield { type: 'text', content: _input }
  yield { type: 'result', options: [] }
}
```

OpenCowork 已有完整实现（`src/renderer/src/lib/prompt-optimizer/optimizer.ts`），方案：
- 用 `streamSidecarProviderTurn`（`providerTurnOnly: true`）做单轮 LLM 调用
- 给模型提供 `WriteOptimizedPrompts` 工具返回 1-3 个优化方案
- wishful-claw 已有 `streamSidecarProviderTurn`、`usePromptOptimizer` hook、UI 组件，可直接复用

---

## Plan 拆分

### Plan 9-1：提示词优化器实现

**目标**：从 OpenCowork 移植 optimizer.ts，实现提示词优化功能。

**步骤**：
1. 从 OpenCowork 移植 `optimizer.ts`，适配 import 路径（`resolveLanguageName`/`AppLanguage` 在 wishful-claw 中路径为 `@renderer/lib/i18n-language`）
2. 适配 `streamSidecarProviderTurn` 的 import 和调用签名
3. 验证：`tsc --noEmit` 通过

**验证检查点**：编译通过 + 输入框输入文本 → 点击优化按钮 → 看到 1-3 个优化方案 → 选择后替换输入框内容

### Plan 9-2：Token 统计修复

**目标**：排查并修复前端 usage 数据丢失问题。

**排查方向**（按优先级）：
1. **MessagePack 编码/解码对齐** — 后端 `AgentStreamMessagePackEmitter.WriteOptionalUsage` 写出的字段名和前端 `TokenUsageWire` 的接口定义是否完全匹配
2. **chat-store message_end 处理** — `msg.usage = event.usage` 在 immer 下是否正确触发 `ComposerRuntimeStatus` 的 `useShallow` selector
3. **runId 匹配** — `handleEnvelope` 中 `streamingMessages` 的 runId 与 envelope.runId 是否匹配，不匹配则事件被丢弃

**步骤**：
1. 在 `handleEnvelope` 的 `message_end` case 加 `console.log` 确认 `event.usage` 是否有值
2. 根据结果定位具体断点
3. 修复
4. 验证：对话过程中输入框底部实时显示 token 数量

**验证检查点**：对话过程中输入框底部显示非零 token 数量

### Plan 9-3：AGENTS.md 路径修正

**目标**：更新参考项目路径。

**步骤**：
1. AGENTS.md 中参考路径表：`D:\gy\OpenCowork` → `D:\claw\OpenCowork`，`D:\gy\koda-claw\koda-claw` → `D:\claw\koda-claw`

**验证检查点**：文档内容正确
