# Plan: v2-iter-14 历史消息反向分页

## 目标

实现 `loadOlderSessionMessages`，用户滚动到消息列表顶部时自动加载更早的历史消息，保持滚动位置不跳动。

参考 Reasonix 的反向分页思路（尾页加载 + prepend），但触发方式从点击按钮改为滚动到顶部。

## 步骤清单

- [ ] 步骤1：实现 `loadOlderSessionMessages` — 调用 `dbListMessagesPage` 加载 `loadedRangeStart` 之前的消息，prepend 到 messages 数组，更新 `loadedRangeStart`
  - 验证检查点：TS 编译通过；函数返回加载的消息数量；`loadedRangeStart` 正确更新
  
- [ ] 步骤2：调整 `loadOlderMessages` 调用参数 — 当前 `useMessageListScroll.ts` 调用 `loadOlderSessionMessages(activeSessionId, undefined, ...)` 传了 `undefined` 作为 limit，确认默认 pageSize 在函数内部处理
  - 验证检查点：TS 编译通过；滚动到顶部能触发加载

- [ ] 步骤3：编译验证 + 功能测试
  - 验证检查点：三个 TS 配置全部 0 错误；C# build 0 错误

## 涉及文件

- `src/renderer/src/stores/chat-store/session-slice.ts` — 修改 `loadOlderSessionMessages` 实现（唯一核心改动）
- `src/renderer/src/components/chat/MessageList/useMessageListScroll.ts` — 确认调用参数传递（可能微调）
- `src/renderer/src/stores/chat-store/db-helpers.ts` — 只读引用（已有 `dbListMessagesPage`）
- `src/renderer/src/stores/chat-store/types.ts` — 只读引用（已有分页字段定义）

## 参考源码

- Reasonix: `D:\claw\DeepSeek-Reasonix\desktop\frontend\src\lib\useController.ts:2188` — `loadOlderHistory` 游标分页思路
- Reasonix: `D:\claw\DeepSeek-Reasonix\desktop\frontend\src\components\Transcript.tsx:906` — 按钮触发方式（不采用，改用滚动）

## 设计决策

### offset 分页 vs 游标分页

Reasonix 用 turn 游标分页（`beforeTurn`），wishful-claw 用 offset 分页。

选择保持 offset 分页，理由：
1. 后端 `ListPage` 已实现 `LIMIT/OFFSET`，无需改动
2. `loadedRangeStart` 已跟踪当前加载范围起始位置
3. wishful-claw 的消息按 `created_at ASC, sort_order ASC` 稳定排序，offset 可靠

### pageSize 选择

- 尾页加载（`loadRecentSessionMessages`）默认 100 条
- 反向分页默认 50 条 — 因为用户已经在看消息了，50 条够回看一段历史，不会太卡

### 消息去重

prepend 时按 `id` 去重，防止边界情况下重复加载。
