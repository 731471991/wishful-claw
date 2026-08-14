# v2-iter-14 探索发现

## 当前状态概述

### 前端基础设施（已完整）

| 组件 | 文件 | 状态 |
|------|------|------|
| 滚动触发 | `useMessageListScroll.ts:362-369` | ✅ `handleListScroll` 在 `scrollTop <= 72px` 时触发 `loadOlderMessages()` |
| 滚动锚点保持 | `useMessageListScroll.ts:266-303` | ✅ 保存 `scrollHeight/scrollTop`，加载后计算 `scrollDelta` 调整 |
| 防重复加载 | `useMessageListScroll.ts:103,111,267,282` | ✅ `isLoadingOlderMessages` + `stalledOlderLoadStartRef` |
| 范围跟踪 | `session-slice.ts:59` + `types.ts:64-68` | ✅ `loadedRangeStart/End`, `messageCount`, `lastKnownMessageCount` |
| 尾页加载 | `session-slice.ts:448-507` | ✅ `loadRecentSessionMessages` — offset = max(0, count - limit) |
| DB 查询封装 | `db-helpers.ts:323-339` | ✅ `dbListMessagesPage({ sessionId, limit, offset })` |
| 消息计数 | `db-helpers.ts:340-344` | ✅ `dbGetMessageCount(sessionId)` |

### 唯一的 stub

`session-slice.ts:509-511`:
```typescript
loadOlderSessionMessages: async (_sessionId, _limit, _options) => {
    // Stub: no DB layer, all messages are already in memory
    return 0
}
```

这是整个功能的唯一缺口。所有上游（滚动触发）和下游（DB 查询）都已就位。

### 后端（已完整）

`DbMessageTools.cs:340-380` — `ListPage` 方法：
```sql
SELECT * FROM messages WHERE session_id = @sid ORDER BY created_at ASC, sort_order ASC LIMIT @limit OFFSET @offset
```

- limit 范围 1~5000，offset ≥ 0
- 按 `created_at ASC, sort_order ASC` 排序
- 返回 `List<MessageRow>`

### Reasonix 参考实现

Reasonix `loadOlderHistory`（`useController.ts:2188`）：
- 基于 turn 游标分页（`beforeTurn = state.historyStartTurn`）
- 调用后端 `HistoryPageForTab(tabId, beforeTurn, HISTORY_PAGE_TURNS)`
- 通过 reducer prepend 到消息列表
- **触发方式**：点击 Transcript 组件中的"显示更早历史"按钮（`Transcript.tsx:906-913`）

### 老大要求的差异

> "往上拉取数据，是通过滚动，而不是 Reasonix 的通过点击元素加载"

wishful-claw 已通过 `handleListScroll` 实现滚动触发，无需 Reasonix 的按钮。

## 实现方案

只需实现 `loadOlderSessionMessages`：

1. 读取当前 session 的 `loadedRangeStart`
2. `pageSize = 50`（每次加载 50 条）
3. `offset = max(0, loadedRangeStart - pageSize)`
4. `limit = min(loadedRangeStart, pageSize)`（最后一段可能不足 pageSize）
5. 调用 `dbListMessagesPage({ sessionId, limit, offset })`
6. 将返回的消息 prepend 到 `session.messages` 数组头部
7. 更新 `loadedRangeStart = offset`
8. 返回加载的消息数量

### 不需要

- 新 IPC 端点（复用 `db/messages-list-page`）
- 后端改动（`ListPage` 已支持 offset 分页）
- 前端 UI 改动（滚动触发已完整）
- 新组件（无 loading 指示器需求——滚动锚点处理已在 `loadOlderMessages` 中）

## 潜在风险

1. **消息去重** — 如果 DB 在加载期间新增了消息，offset 会偏移导致重复。但 `loadRecentSessionMessages` 加载的是尾部，`loadOlderSessionMessages` 加载的是头部，两者范围不重叠，风险低。
2. **性能** — 每次加载 50 条，prepend 到数组头部是 O(n) 操作。对于 1000+ 条消息的会话可能有轻微卡顿，但 immer 的结构共享会优化大部分场景。
