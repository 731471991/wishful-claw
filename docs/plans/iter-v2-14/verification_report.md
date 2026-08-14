# 验证报告 — v2-iter-14

## 编译验证

| 配置 | 结果 |
|------|------|
| TypeScript `tsconfig.web.json` | ✅ 0 错误 |
| TypeScript `tsconfig.node.json` | ✅ 0 错误 |
| TypeScript `tsconfig.json` | ✅ 0 错误 |
| C# `dotnet build WishfulClaw.sln` | ✅ 0 错误（1 个 NETSDK1194 警告，无影响） |

## 代码变更总结

### 后端（C#）
- `DbMessageTools.cs`：新增 `ListLocator`（轻量索引查询）+ `ListByTurns`（按轮次分页查询）
- `DbModule.cs`：注册 `db/messages-list-locator` + `db/messages-list-by-turns` 端点
- `MessageEntity.cs`：新增 `MessageListByTurnsResult` record
- `InfrastructureJsonContext.cs`：注册 `MessageListByTurnsResult`

### 前端（TS）
- `index.ts`：locator IPC stub 改为转发 Worker
- `db-helpers.ts`：新增 `dbListMessagesByTurns` 封装
- `session-slice.ts`：
  - `loadRecentSessionMessages` 改为按轮次加载最近 5 轮
  - `loadOlderSessionMessages` 实现反向分页（prepend + 游标）
  - `loadMessageWindowAround` 实现跳转加载
  - `loadedRangeStart` 语义从 DB offset 改为 sort_order
- `useMessageListData.ts`：locator rows 加 camelCase→snake_case 字段映射

## 功能验证标准

以下为需要用户人工验证的项：

1. **打开长会话** → 只加载最近 5 轮对话（不是全量 100 条）
2. **滚动到顶部** → 自动加载更早 5 轮，滚动位置不跳动
3. **右侧定位栏** → 显示对话轮次标记（不再为空）
4. **点击定位栏条目** → 跳转到对应消息（未加载时自动加载该轮次）

## 验证结果

编译验证全部通过。功能验证待用户人工确认。
