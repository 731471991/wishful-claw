# Plan 4: 右侧 workbench tab

## 目标

右侧面板新增 `workbench` tab kind，渲染当前 session 的完整工具调用列表（复用 tool-call-slice 的 session 级数据），用 full 模式 ToolCallCard 渲染完整预览。切换会话时工作台内容跟随切换。

## 前置依赖

Plan 3（ToolCallCard compact/full 模式已就绪）

## 步骤清单

- [ ] 步骤1：ui-types.ts 新增 `'workbench'` tab kind — `RightPanelTabKind` 联合类型增加成员
  - 验证：类型扩展无编译错误
- [ ] 步骤2：新建 `WorkbenchPanel.tsx` 组件 — 从 tool-call-slice 获取当前 session 的 executed tool calls，用 full 模式 ToolCallCard 逐个渲染。按时间线排序
  - 验证：组件能渲染工具调用列表，包含完整输出预览
- [ ] 步骤3：RightPanel.tsx 增加 workbench tab 渲染分支 — tab.kind === 'workbench' 时渲染 WorkbenchPanel
  - 验证：右侧面板能显示工作台内容
- [ ] 步骤4：Agent 执行工具时自动创建/激活 workbench tab — 工具调用开始时自动在工作台 tab 中打开（如果还没有则创建），不影响聊天流
  - 验证：Agent 执行工具时右侧面板自动出现工作台内容
- [ ] 步骤5：会话级隔离 — WorkbenchPanel 根据 panelSessionId 获取对应 session 的工具调用。切换会话时内容跟随切换
  - 验证：切换会话后工作台显示对应 session 的工具调用
- [ ] 步骤6：双编译验证 — `npx tsc --noEmit -p tsconfig.web.json` 零错误
  - 验证：TypeScript 编译通过

## 涉及文件

- `src/renderer/src/stores/ui-types.ts` — 修改，新增 workbench tab kind
- `src/renderer/src/components/layout/WorkbenchPanel.tsx` — 新建，工作台面板组件
- `src/renderer/src/components/layout/RightPanel.tsx` — 修改，增加 workbench 渲染分支
- `src/renderer/src/stores/ui-store.ts` — 修改，可能需要 workbench tab 自动创建逻辑

## 设计细节

### WorkbenchPanel 数据来源

```tsx
function WorkbenchPanel({ sessionId }: { sessionId: string }) {
  // 从 agent-store 获取该 session 的 executed tool calls
  const executedToolCalls = useAgentStore(useShallow((s) => {
    const cache = s.sessionToolCallsCache[sessionId]
    return cache?.executed ?? s.executedToolCalls.filter(tc => tc.sessionId === sessionId)
  }))

  // 渲染完整 ToolCallCard 列表
  return executedToolCalls.map(tc => (
    <ToolCallCard mode="full" {...resolveToolCallProps(tc)} />
  ))
}
```

### 自动激活时机

- 工具调用开始（addToolCall）时，如果右侧面板没有 workbench tab 则创建一个
- 不自动切换 active tab（用户可能在看其他 tab），但如果右侧面板关闭则自动打开
- 或者：有工具调用执行时自动切换到 workbench tab（需要确认用户体验）
