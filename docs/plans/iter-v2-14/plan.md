# Plan: v2-iter-14 历史消息反向分页 + 右侧定位栏接线

## 目标

1. 实现按对话轮次的反向分页：默认加载最近 5 轮对话，滚动到顶部加载更早 5 轮
2. 接线右侧定位栏（AssistantReplyRail）：后端提供 locator 数据源，前端渲染轮次标记，点击跳转时自动加载对应轮次

两者共享同一个数据源：会话中所有 user 消息的轻量索引。

## 步骤清单

- [ ] 步骤1：后端新增 `ListLocator` 方法 — `DbMessageTools.cs` 新增查询，返回会话中所有消息的 `id/role/content/created_at/sort_order`（轻量级，不含 meta/usage）；`DbModule.cs` 注册 `db/messages-list-locator` 端点
  - 验证检查点：C# 编译 0 错误

- [ ] 步骤2：后端新增 `ListByTurns` 方法 — `DbMessageTools.cs` 新增按轮次查询：找出 `beforeSortOrder` 之前最近 N 个 user 消息，返回这些轮次的所有消息；`DbModule.cs` 注册 `db/messages-list-by-turns` 端点；新增 `MessageListByTurnsResult` record + 注册到 `InfrastructureJsonContext`
  - 验证检查点：C# 编译 0 错误

- [ ] 步骤3：接线 locator IPC — `src/main/index.ts` 将 `db:messages:list-locator:msgpack` stub 改为转发到 Worker `db/messages-list-locator`
  - 验证检查点：TS 编译通过

- [ ] 步骤4：前端新增封装 — `db-helpers.ts` 新增 `dbListMessagesByTurns`；确认 `invokeMessagePackBinary` 的 locator 调用已经能用
  - 验证检查点：TS 编译通过

- [ ] 步骤5：改写 `loadRecentSessionMessages` — 从 offset 分页改为调用 `dbListMessagesByTurns(turns=5)`，`loadedRangeStart` 语义改为 sort_order
  - 验证检查点：TS 编译通过；打开会话只加载最近 5 轮对话

- [ ] 步骤6：实现 `loadOlderSessionMessages` — 调用 `dbListMessagesByTurns(beforeSortOrder=loadedRangeStart, turns=5)`，prepend 到 messages 数组，更新 `loadedRangeStart`
  - 验证检查点：TS 编译通过；滚动到顶部触发加载更早 5 轮

- [ ] 步骤7：实现 `loadMessageWindowAround` — 点击 rail item 跳转到未加载的消息时，根据 `sortOrder` 找到所在轮次，加载该轮次前后消息
  - 验证检查点：TS 编译通过；点击右侧定位栏条目能跳转到对应消息

- [ ] 步骤8：编译验证 — 三个 TS 配置 + C# build 全部 0 错误
  - 验证检查点：全部编译通过

## 涉及文件

### 后端
- `src/runtime/WishfulClaw.Infrastructure/Db/DbMessageTools.cs` — 新增 `ListLocator` + `ListByTurns`
- `src/runtime/WishfulClaw.Infrastructure/Db/DbModule.cs` — 注册 2 个新端点
- `src/runtime/WishfulClaw.Infrastructure/Db/Entities/MessageEntity.cs` — 新增 `MessageListByTurnsResult` record
- `src/runtime/WishfulClaw.Infrastructure/JsonContexts/InfrastructureJsonContext.cs` — 注册新类型

### 前端
- `src/main/index.ts` — locator stub 改为转发 Worker
- `src/renderer/src/stores/chat-store/db-helpers.ts` — 新增 `dbListMessagesByTurns`
- `src/renderer/src/stores/chat-store/session-slice.ts` — 改写 `loadRecentSessionMessages` + 实现 `loadOlderSessionMessages` + 实现 `loadMessageWindowAround`
- `src/renderer/src/components/chat/MessageList/useMessageListData.ts` — 确认 locator 数据流贯通

## 参考源码

- Reasonix: `D:\claw\DeepSeek-Reasonix\desktop\frontend\src\lib\useController.ts:2188` — `loadOlderHistory` 轮次游标分页思路
- Reasonix: `D:\claw\DeepSeek-Reasonix\desktop\frontend\src\components\Transcript.tsx:906` — 按钮触发方式（不采用，改用滚动）

## 设计决策

### 后端 ListLocator 逻辑

返回会话中所有消息的轻量索引（不含 meta/usage 大字段）：

```sql
SELECT id, session_id, role, content, created_at, sort_order
FROM messages WHERE session_id = @sid
ORDER BY sort_order ASC
```

前端 `parseLocatorRowSource` 已经期望这个格式（`MessageLocatorIndexRow`）。

### 后端 ListByTurns 逻辑

```sql
-- 1. 找出 beforeSortOrder 之前最近的 N 个 user 消息的 sort_order
SELECT sort_order FROM messages
WHERE session_id = @sid AND role = 'user'
  AND (@before IS NULL OR sort_order < @before)
ORDER BY sort_order DESC
LIMIT @turns

-- 2. 取最早的 sort_order 作为 rangeStart

-- 3. 查出 rangeStart 到 beforeSortOrder 之间的所有消息
SELECT * FROM messages
WHERE session_id = @sid AND sort_order >= @rangeStart
  AND (@before IS NULL OR sort_order < @before)
ORDER BY sort_order ASC

-- 4. 检查是否还有更早的 user 消息
SELECT EXISTS(SELECT 1 FROM messages
WHERE session_id = @sid AND role = 'user' AND sort_order < @rangeStart)
```

### loadMessageWindowAround 逻辑

点击 rail item 跳转时，目标消息可能不在已加载范围内：
1. 用 rail item 的 `sortOrder` 作为 beforeSortOrder
2. 调用 `ListByTurns(turns=3)` 加载目标轮次及前后 1-2 轮
3. 替换 session.messages 为新加载的消息
4. 更新 `loadedRangeStart/End`
5. `scroll-utils.ts` 的 `createJumpToAssistantMessage` 已经处理了加载后跳转逻辑

### loadedRangeStart 语义变更

从 DB offset 改为 sort_order（第一个已加载消息的序号）。
`loadedRangeStart <= 0` 的检查仍然有效——sort_order=0 表示第一条消息。
