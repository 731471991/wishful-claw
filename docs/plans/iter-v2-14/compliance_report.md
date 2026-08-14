# 规划验证报告 — v2-iter-14

## 检查结果

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 步骤完整覆盖目标 | ✅ | 8 步：后端 locator → 后端 by-turns → 接线 IPC → 前端封装 → 改写尾页 → 实现 reverse paging → 实现 jump-to → 编译验证 |
| 每步有验证检查点 | ✅ | 步骤1-2：C#编译；步骤3-7：TS编译+功能；步骤8：全量编译 |
| 文件路径符合项目结构 | ✅ | DbMessageTools/DbModule/MessageEntity（Infrastructure/Db/）、db-helpers/session-slice（stores/chat-store/）、index.ts（main/） |
| 分层依赖正确 | ✅ | 后端 Infrastructure 层（DbMessageTools → EntityMappers），前端 store 层，Main 转发 IPC，无跨层依赖 |
| AOT 兼容 | ✅ | 新增 `MessageListByTurnsResult` record（具名类型），注册到 `InfrastructureJsonContext` |
| 参考源码路径正确 | ✅ | Reasonix useController.ts:2188 + Transcript.tsx:906 |
| 搬入代码适配 | ✅ | 不照搬，只参考轮次分页思路；触发方式从按钮改为滚动 |
| locator stub 修复 | ✅ | `db:messages:list-locator:msgpack` 从 stub 改为转发 Worker |

## ❌ 项

0 项。通过。

## 风险评估

- 后端改动：2 个新方法 + 2 个新端点 + 1 个 record 类型（约 100 行 C#）
- 前端改动：1 个 IPC 接线 + 1 个新封装 + 3 个函数改写（约 100 行 TS）
- `loadedRangeStart` 语义变更影响 `useMessageListScroll.ts`，但 `<= 0` 逻辑不变
- locator 数据流贯通后右侧定位栏将首次有数据
- `loadMessageWindowAround` 实现后点击跳转功能将首次可用
