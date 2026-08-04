# Plan 5 — ~~compact→full 联动~~ (已废弃)

> **状态：已废弃** — 依赖 compact 模式和右侧工作台，两者均已移除。

## 废弃原因

联动机制（onCompactClick + CustomEvent 'workbench:focus-tool'）依赖 compact 模式和右侧工作台。
两者被废弃后，联动机制无存在意义，已随 Plan 3/4 一起回退。

## 保留的改动

Plan 5 commit 中同时包含的**取消执行时折叠过程 + 显示固定文本**逻辑保留在 content-renderer.tsx 中，
这部分属于 Plan 1 的折叠块行为，不属于工作台联动。
