# 审查报告 — v2-iter-14

## 审查项

### 1. 代码是否符合分层约定
✅ 后端改动全在 Infrastructure 层（DbMessageTools / DbModule / MessageEntity / JsonContext），前端改动在 store 层和 component 层，Main 进程只做 IPC 转发。无跨层依赖。

### 2. 是否有硬编码路径、密钥等
✅ 无硬编码路径或密钥。SQL 参数全部使用 `@param` 占位符。

### 3. 是否正确实现参考源码的逻辑
✅ 参考 Reasonix 的轮次游标分页思路，但：
- 触发方式从按钮改为滚动（已有基础设施）
- 用 sort_order 游标代替 turn 游标（wishful-claw 的消息有 sort_order 字段）
- 不照搬 Reasonix 代码，只参考思路

### 4. 错误处理是否充分
✅ 后端所有方法都有 try-catch，失败时返回空结果或 error record。前端 loadRecent/loadOlder/loadWindowAround 都有 try-catch。

### 5. 是否引入了不需要的依赖
✅ 无新依赖。复用已有的 `dbListMessagesPage` → `dbListMessagesByTurns`（同一 IPC 通道模式）、`MessageRow`（已有 DTO）、`InfrastructureJsonContext`（已有 JsonContext）。

### 6. AOT 兼容性
✅ 新增 `MessageListByTurnsResult` 是具名 record，已注册到 `InfrastructureJsonContext`。`ListByTurns` 中使用 `db.Query<T>` + lambda mapper，无反射。

### 7. loadedRangeStart 语义变更影响
✅ 从 DB offset 改为 sort_order。`useMessageListScroll.ts` 中 `loadedRangeStart <= 0` 的检查仍然有效（sort_order=0 = 第一条消息）。`loadedRangeStart > 0` 仍表示有更早消息可加载。

### 8. locator 字段名映射
✅ Worker 返回 camelCase（`createdAt/sortOrder`），前端 `MessageLocatorIndexRow` 期望 snake_case（`created_at/sort_order`）。在 `useMessageListData.ts` 中添加了显式字段映射。

## ❌ 项

0 项。通过。
