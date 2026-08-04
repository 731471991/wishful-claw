# Plan 3 — ~~ToolCallCard compact 模式~~ (已废弃)

> **状态：已废弃** — 用户决策去掉右侧工作台，compact 模式不再需要。
> 折叠块内的 ToolCallCard 保留原有可展开预览能力 (CollapsibleHeightPanel)，无需 compact 模式。

## 废弃原因

compact 模式的初衷是为右侧工作台提供简化版工具卡片。用户发现：
1. 折叠块内的 ToolCallCard 本身就有展开/折叠预览能力
2. compact 模式去掉了这个能力，再搞工作台补回来是绕圈子
3. 历史消息的工作台数据会断裂（sessionToolCallsCache 不被填充）

## 已回退的文件

- ToolCallCard/types.ts — 移除 mode/onCompactClick 属性
- ToolCallCard/index.tsx — 移除 compact 渲染分支
- ToolCallCard/utils.ts — 移除 mode 比较
- tool-block-renderer.tsx — 移除 mode/onCompactClick 透传
- content-renderer.tsx — 移除 toolBlockProps 中的 mode='compact' 和 onCompactClick
