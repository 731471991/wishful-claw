# Plan 3: ToolCallCard compact 模式

## 目标

给 ToolCallCard 新增 `mode: 'compact' | 'full'` prop。compact 模式去掉 output-blocks 渲染，只保留 compact-header + input-summary + status。聊天流折叠块内用 compact，右侧工作台用 full。

## 前置依赖

Plan 2（折叠块内已有精简列表渲染位置）

## 步骤清单

- [ ] 步骤1：ToolCallCard types 新增 mode 字段 — `ToolCallCardProps` 新增 `mode?: 'compact' | 'full'`，默认 `'full'` 保持向后兼容
  - 验证：类型定义正确，现有使用不受影响
- [ ] 步骤2：compact 模式渲染逻辑 — `mode === 'compact'` 时：只渲染 CompactToolCallHeader + StructuredInput（折叠），不渲染 output-blocks。去掉 CollapsibleHeightPanel 包裹的输出预览区域
  - 验证：compact 模式不渲染输出预览；full 模式行为不变
- [ ] 步骤3：content-renderer 中折叠块内工具调用传 compact mode — ExecutionProcessBlock 内的 ToolBlockRenderer 接收 mode 参数，传给 ToolCallCard
  - 验证：折叠块内工具卡片只显示精简信息
- [ ] 步骤4：双编译验证 — `npx tsc --noEmit -p tsconfig.web.json` 零错误
  - 验证：TypeScript 编译通过

## 涉及文件

- `src/renderer/src/components/chat/ToolCallCard/types.ts` — 修改，新增 mode 字段
- `src/renderer/src/components/chat/ToolCallCard/index.tsx` — 修改，compact 模式渲染分支
- `src/renderer/src/components/chat/AssistantMessage/tool-block-renderer.tsx` — 修改，透传 mode
- `src/renderer/src/components/chat/AssistantMessage/content-renderer.tsx` — 修改，过程组传 compact mode

## 设计细节

### compact 模式渲染

```tsx
{mode === 'compact' ? (
  <>
    <CompactToolCallHeader ... />
    {/* 不渲染 output-blocks */}
  </>
) : (
  // 现有 full 模式渲染
  <>
    <CompactToolCallHeader ... />
    <CollapsibleHeightPanel open={...}>
      {/* output-blocks */}
    </CollapsibleHeightPanel>
  </>
)}
```

### ToolBlockRenderer 透传

`ToolBlockRendererProps` 新增 `mode?: 'compact' | 'full'`，透传到 `ToolCallCard`。
