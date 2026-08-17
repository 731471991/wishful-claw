# v2-iter-14 探索发现

## 当前状态概述

### 前端基础设施（已完整）

| 组件 | 文件 | 状态 |
|------|------|------|
| 滚动触发 | `useMessageListScroll.ts:362-369` | ✅ `handleListScroll` 在 `scrollTop <= 72px` 时触发 `loadOlderMessages()` |
| 滚动锚点保持 | `useMessageListScroll.ts:266-303` | ✅ 保存 `scrollHeight/scrollTop`，加载后计算 `scrollDelta` 调整 |
| 防重复加载 | `useMessageListScroll.ts:103,111,267,282` | ✅ `isLoadingOlderMessages` + `stalledOlderLoadStartRef` |
| 范围跟踪 | `session-slice.ts:59` + `types.ts:64-68` | ✅ `loadedRangeStart/End`, `messageCount`, `lastKnownMessageCount` |
| 尾页加载 | `session-slice.ts:448-507` | ✅ `loadRecentSessionMessages` — offset = max(0, count - limit)，limit=100 |
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

### 后端现有分页

`DbMessageTools.cs:340-380` — `ListPage` 方法用 `LIMIT @limit OFFSET @offset`，按 `created_at ASC, sort_order ASC` 排序。

### 消息数据模型

- `MessageEntity` 字段：`Id`, `SessionId`, `Role`('user'/'assistant'/'system'), `Content`, `Meta`(JSON), `CreatedAt`, `Usage`(JSON), `SortOrder`(int)
- `sort_order` = 消息在会话中的序号，0 开始递增，由前端 `session.messages.indexOf(msg)` 分配
- 一轮对话 = 一个 `role='user'` 消息 + 后续所有 `role='assistant'`/`'system'` 消息（直到下一个 user 消息）

### 老大的需求

> "加载顺序是反向的，比如默认就获取最近最新5条用户发言到agent的回复内容，而不是单纯的多少条数据"

- **分页单位**：对话轮次（user → assistant 完整往返），不是消息条数
- **默认加载**：最近 5 轮对话
- **反向分页**：往上滚动加载更早 5 轮
- **触发方式**：滚动到顶部（非 Reasonix 的点击按钮）

### Reasonix 参考

- Reasonix `loadOlderHistory`（`useController.ts:2188`）用 turn 游标分页（`beforeTurn`）
- 触发方式是点击按钮（`Transcript.tsx:906`），老大要求改为滚动触发（已有基础设施）

### `loadedRangeStart` 语义变更

当前 `loadedRangeStart` = DB offset（如 50 表示从第 50 条开始）。
改为 `loadedRangeStart` = 已加载消息中最早消息的 `sort_order`。
- `loadedRangeStart <= 0` → 已加载到最早消息，无更早历史
- `loadedRangeStart > 0` → 可能还有更早消息可加载

## 实现方案

### 后端：新增 `db/messages-list-by-turns` 端点

参数：`sessionId`, `beforeSortOrder`（可选，不传 = 从最新开始）, `turns`（默认 5）

逻辑：
1. 查出 `beforeSortOrder` 之前最近的 N 个 user 消息的 sort_order
2. 取最早的 sort_order 作为 rangeStart
3. 查出 rangeStart 到 beforeSortOrder 之间的所有消息
4. 返回 messages + rangeStart + hasMore

### 前端

1. 新增 `dbListMessagesByTurns` 封装
2. `loadRecentSessionMessages` 改为调用新端点（turns=5）
3. `loadOlderSessionMessages` 实现为调用新端点（beforeSortOrder=loadedRangeStart, turns=5），prepend 到 messages

## 右侧定位栏（AssistantReplyRail）现状

### 已有的前端基础设施

- `AssistantReplyRail.tsx` — 完整的 UI 组件，显示轮次标记列表（user/assistant/streaming/summary）
- `scroll-utils.ts` — `createJumpToAssistantMessage` 完整实现，支持跨页跳转（先查 DOM，找不到时调 `loadMessageWindowAround` 加载目标窗口，再跳转）
- `locator-utils.ts` — `buildAssistantRailLayout` 完整实现，将消息列表转为 rail items
- `useMessageListData.ts` — 会话切换时加载 `messageLocatorRows`

### 缺失的数据源

`db:messages:list-locator:msgpack` IPC handler 是 stub（`src/main/index.ts:369` 返回 null）。
后端 Worker 没有 locator 端点。
`loadMessageWindowAround` 只有类型声明，没有实现。

### 老大的思路

右侧定位栏本质就是对话轮次的索引——每条 rail item = 一轮对话的标记（user 消息或 assistant 消息）。
分页也是按轮次的。两者共享同一个数据源：

1. **后端新增 `db/messages-list-locator` 端点** — 返回会话中所有 user 消息的 `id/sort_order/created_at/content`（轻量级，不含 meta/usage）
2. **定位栏**用这个列表渲染 rail items
3. **分页**用这个列表计算轮次范围
4. **跳转到未加载的消息**时，用 rail item 的 `sortOrder` 找到它在哪一轮，加载该轮次附近的消息

1. **AOT 兼容**：新增结果 record 类型需注册到 `InfrastructureJsonContext`
2. **sort_order=0 边界**：`loadedRangeStart <= 0` 既表示"已到最早"也表示"初始未加载"，需区分（用 `messagesLoaded` flag 已有）
3. **消息去重**：prepend 时按 id 去重防边界重复
