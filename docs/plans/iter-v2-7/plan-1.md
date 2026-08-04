# Plan 1: content-renderer 拆分渲染 + collapsible 动态计算

## 目标

将 ContentRenderer 从"平铺所有 blocks"改为"过程部分（折叠块内） + 最终文本部分（折叠块外）"的渲染模式。collapsible 动态计算——有执行过程时为 true，纯一问一答为 false。

## 步骤清单

- [ ] 步骤1：新建 `ExecutionProcessBlock.tsx` 折叠块组件 — 包裹执行过程内容（thinking + tool-run + 中途 text + compact-summary），通过 `collapsible` prop 控制行为：`false` 不渲染折叠块（内容为空时），`true` 执行中展开 / 结束后自动折叠成摘要。复用现有 `GenerationProcessLine` 作为折叠头部
  - 验证：组件能渲染/不渲染，折叠/展开状态切换正常
- [ ] 步骤2：在 `content-renderer.tsx` 中拆分 renderItems 为过程组和最终文本组 — 从后往前找最后一个 text/image/image_error/agent_error block 作为最终输出分界点，之前的 items 归为过程组，之后的归为最终文本组。过程组传入 ExecutionProcessBlock，最终文本组在折叠块之外渲染
  - 验证：纯聊天（单个 text block）无折叠块出现；有工具调用时折叠块出现且执行中展开
- [ ] 步骤3：collapsible 动态计算 — 过程组有内容 → true；过程组为空 → false。在 `AssistantMessage/index.tsx` 中计算并传入 ContentRenderer
  - 验证：纯聊天 collapsible=false 不渲染折叠块；工具调用 collapsible=true 执行中展开
- [ ] 步骤4：执行结束后自动折叠 — isStreaming 从 true → false 时，折叠块自动折叠。用 useEffect 监听 isStreaming 变化
  - 验证：执行中折叠块展开实时更新；执行结束后自动折叠
- [ ] 步骤5：保留 string content 渲染路径 — content 为 string 时也走新的拆分逻辑（think segments 中的 think 部分为过程，最后的 text segment 为最终文本）
  - 验证：string content 的 think tags 正确分入过程/最终文本
- [ ] 步骤6：双编译验证 — `npx tsc --noEmit -p tsconfig.web.json` 零错误
  - 验证：TypeScript 编译通过

## 涉及文件

- `src/renderer/src/components/chat/AssistantMessage/execution-process-block.tsx` — 新建，折叠块组件
- `src/renderer/src/components/chat/AssistantMessage/content-renderer.tsx` — 修改，拆分渲染逻辑
- `src/renderer/src/components/chat/AssistantMessage/index.tsx` — 修改，计算 collapsible 并传入
- `src/renderer/src/components/chat/AssistantMessage/types.ts` — 修改，新增相关类型

## 参考源码

- 灵犀自身渲染模式（执行过程折叠 + 最终文本在外）
- 现有 `GenerationProcessLine`（ui-buttons.tsx）— 折叠头部样式参考
- 现有 `CollapsibleHeightPanel`（CollapsibleHeightPanel.tsx）— 折叠面板复用

## 设计细节

### ExecutionProcessBlock 组件

```tsx
interface ExecutionProcessBlockProps {
  collapsible: boolean
  isStreaming: boolean
  collapsed: boolean
  onToggle: () => void
  summary?: string  // 折叠时的摘要文本
  children: React.ReactNode
}
```

行为：
- `collapsible=false`：不渲染（过程内容为空）
- `collapsible=true` + `isStreaming=true`：展开，显示过程内容
- `collapsible=true` + `isStreaming=false`：自动折叠，显示摘要头部
- 点击头部切换展开/折叠

### 过程/最终文本分界算法

```
从后往前遍历 renderItemsWithInlineSummaries：
  找到最后一个 text block 或 image/image_error/agent_error block 的位置 → finalOutputStart
  [0, finalOutputStart) → 过程组（传入 ExecutionProcessBlock）
  [finalOutputStart, end] → 最终文本组（折叠块外渲染）
```

特殊情况：
- 纯 text（一个 block）→ 过程组为空，collapsible=false
- 只有 thinking + text → thinking 是过程，text 是最终文本
- 有 tool_use + text → tool_use 是过程，最后的 text 是最终文本
- 有 tool_use 无 text（工具执行中还没回复）→ 全部是过程，collapsible=true，无最终文本
