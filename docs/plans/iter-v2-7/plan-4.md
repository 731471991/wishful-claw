# Plan 4 — ~~右侧 workbench tab~~ (已废弃)

> **状态：已废弃** — 用户决策去掉右侧工作台。

## 废弃原因

用户观察到折叠块已经实现了想要的效果，ToolCallCard 在折叠块内可以展开看预览。
右侧工作台与折叠块内容重复，且历史消息的工作台数据会断裂。
详见 plan-3.md 的废弃原因。

## 已回退/删除的文件

- WorkbenchPanel.tsx — 已删除
- RightPanel.tsx — 回退到 Plan 4 之前（移除 workbench 渲染分支、自动创建、事件监听）
- ui-types.ts — 移除 'workbench' tab kind
- ui-store.ts — 移除 ensureWorkbenchTab 方法
- ui-store-interface.ts — 移除 ensureWorkbenchTab 接口
