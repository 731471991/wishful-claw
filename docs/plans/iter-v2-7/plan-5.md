# Plan 5: compact→full 联动 + 端到端验证 + 收尾

## 目标

点击聊天流折叠块内的 compact ToolCallCard 时，右侧面板自动打开工作台 tab 并定位到对应工具调用。全链路验证 v2-iter-7 验证标准。

## 前置依赖

Plan 1-4 全部完成

## 步骤清单

- [ ] 步骤1：compact ToolCallCard 点击联动 — 点击 compact 模式的工具卡片时，打开右侧面板 + 切换到 workbench tab + 滚动定位到对应 full ToolCallCard
  - 验证：点击聊天流中的 compact 卡片 → 右侧面板打开并定位到完整预览
- [ ] 步骤2：用户交互保留在折叠块 — 验证 AskUserQuestion/PlanReview 等需要用户操作的交互卡片不迁移到工作台，保留在折叠块内
  - 验证：选项选择、输入回复等交互在折叠块内可操作
- [ ] 步骤3：执行后操作按钮保留 — 验证 debug/copy/retry 等操作按钮不受影响
  - 验证：操作按钮正常工作
- [ ] 步骤4：端到端验证 — 纯聊天 → 折叠块不出现；发送消息触发工具 → collapsible 变 true，执行中展开实时更新，结束后折叠成摘要 → 右侧工作台展示完整预览 → 切换会话工作台跟随隔离 → 点击摘要可展开看精简列表 → 点击精简卡片联动到工作台
  - 验证：验证标准全通过
- [ ] 步骤5：tsc + dotnet build 双编译验证
  - 验证：零编译错误
- [ ] 步骤6：边界情况处理 — 空 content、只有 thinking 无 text、只有 tool_use 无 text、多轮 loop、中途取消等场景
  - 验证：边界场景不崩溃、渲染正确

## 涉及文件

- `src/renderer/src/components/chat/ToolCallCard/index.tsx` — 修改，compact 模式增加 onClick 联动
- `src/renderer/src/components/layout/WorkbenchPanel.tsx` — 修改，支持定位滚动
- `src/renderer/src/stores/ui-store.ts` — 修改，可能需要 workbench tab 定位 state

## 验证标准（来自 iteration-plan.md）

1. 纯聊天 → 折叠块展开不可折叠（一问一答）
2. 发送消息触发工具 → `collapsible` 变为 `true`，执行中展开实时更新
3. 结束后自动折叠成摘要
4. 右侧工作台展示完整预览
5. 切换会话工作台跟随隔离
6. 点击摘要可展开看精简列表
7. 点击精简卡片联动到工作台完整预览
