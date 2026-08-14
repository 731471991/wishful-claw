# Plan: v2-iter-14 历史消息反向分页（按对话轮次）

## 目标

实现按对话轮次的反向分页：默认加载最近 5 轮对话（user → assistant 完整往返），滚动到顶部时自动加载更早 5 轮。参考 Reasonix 的轮次分页思路，触发方式改为滚动。

## 步骤清单

- [ ] 步骤1：后端新增 `ListByTurns` 方法 — `DbMessageTools.cs` 新增按轮次查询方法，`DbModule.cs` 注册 `db/messages-list-by-turns` 端点，新增 `MessageListByTurnsResult` record + 注册到 `InfrastructureJsonContext`
  - 验证检查点：C# 编译 0 错误

- [ ] 步骤2：前端新增 `dbListMessagesByTurns` 封装 — `db-helpers.ts` 新增 IPC 调用封装
  - 验证检查点：TS 编译通过

- [ ] 步骤3：改写 `loadRecentSessionMessages` — 从 offset 分页改为调用 `dbListMessagesByTurns(turns=5)`，`loadedRangeStart` 语义从 DB offset 改为 sort_order
  - 验证检查点：TS 编译通过；打开会话只加载最近 5 轮对话

- [ ] 步骤4：实现 `loadOlderSessionMessages` — 调用 `dbListMessagesByTurns(beforeSortOrder=loadedRangeStart, turns=5)`，prepend 到 messages 数组头部，更新 `loadedRangeStart`
  - 验证检查点：TS 编译通过；滚动到顶部触发加载更早 5 轮

- [ ] 步骤5：编译验证 — 三个 TS 配置 + C# build 全部 0 错误
  - 验证检查点：全部编译通过

## 涉及文件

- `src/runtime/WishfulClaw.Infrastructure/Db/DbMessageTools.cs` — 新增 `ListByTurns` 方法
- `src/runtime/WishfulClaw.Infrastructure/Db/DbModule.cs` — 注册新端点
- `src/runtime/WishfulClaw.Infrastructure/Db/Entities/MessageEntity.cs` — 新增 `MessageListByTurnsResult` record
- `src/runtime/WishfulClaw.Infrastructure/JsonContexts/InfrastructureJsonContext.cs` — 注册新类型
- `src/renderer/src/stores/chat-store/db-helpers.ts` — 新增 `dbListMessagesByTurns`
- `src/renderer/src/stores/chat-store/session-slice.ts` — 改写 `loadRecentSessionMessages` + 实现 `loadOlderSessionMessages`
- `src/renderer/src/stores/chat-store/types.ts` — 可能调整类型注释（无需改字段）

## 参考源码

- Reasonix: `D:\claw\DeepSeek-Reasonix\desktop\frontend\src\lib\useController.ts:2188` — `loadOlderHistory` 轮次游标分页思路
- Reasonix: `D:\claw\DeepSeek-Reasonix\desktop\frontend\src\components\Transcript.tsx:906` — 按钮触发方式（不采用，改用滚动）

## 设计决策

### 后端 ListByTurns 逻辑

```sql
-- 1. 找出 beforeSortOrder 之前最近的 N 个 user 消息
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

### loadedRangeStart 语义变更

| 场景 | 旧值（DB offset） | 新值（sort_order） |
|------|-------------------|-------------------|
| 初始未加载 | 0 | 0 |
| 已加载最近5轮，第6条消息是第一个user | 100（假设共150条） | 5（sort_order） |
| 已加载到最早 | 0 | 0 |

`loadedRangeStart <= 0` 的检查仍然有效——sort_order=0 表示第一条消息。

### pageSize

- 默认每次加载 5 轮对话
- 一轮 = 1 个 user + 1~N 个 assistant（含工具调用等）
- 实际消息条数不固定，由 DB 查询结果决定
