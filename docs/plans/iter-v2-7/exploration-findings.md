# v2-iter-7 探索发现

## 迭代目标

借鉴灵犀的工作台模式——聊天窗用折叠块组件渲染 Agent 回复的执行过程，工具调用预览移至右侧面板"工作台" tab，实现聊天流清爽 + 执行详情分离。

## 当前渲染链路

```
MessageList → MessageRow → AssistantMessage/index.tsx (607行)
  ├─ 构建 normalizedContent (ContentBlock[])
  ├─ 构建 toolExecutionOutline (工具执行大纲，将连续 tool_use 分组为 run)
  ├─ 构建 renderItems (block 或 tool-run 列表)
  ├─ 构建 renderItemsWithInlineSummaries (插入 compact-summary)
  ├─ renderContent() → <ContentRenderer .../>
  └─ <AssistantActionBar collapsed={collapsed} setCollapsed={setCollapsed} renderContent={renderContent} />
```

### ContentRenderer 渲染逻辑 (content-renderer.tsx, 464行)

遍历 `renderItemsWithInlineSummaries`，每个 item 按 kind 分发：

| item kind | 渲染为 | 说明 |
|-----------|--------|------|
| `compact-summary` | ContextCompressionMessage | 上下文压缩摘要 |
| `block` (thinking) | ThinkingBlock | 思考过程，可折叠 |
| `block` (text) | StreamingMarkdownContent | 文本内容（可能含 think tags） |
| `block` (tool_use) | ToolBlockRenderer → ToolCallCard | 工具调用卡片（完整预览） |
| `block` (image) | ImagePreview | 生成的图片 |
| `block` (image_error) | ImageGenerationErrorCard | 图片生成错误 |
| `block` (agent_error) | AgentErrorCard | Agent 错误 |
| `block` (web_search) | WebSearchBlock | 网络搜索结果 |
| `tool-run` | renderToolRun() | run 级折叠：showToggle + CollapsibleHeightPanel |

**所有 blocks 按顺序平铺渲染，没有"过程 vs 最终文本"的区分。**

### 现有折叠机制

1. **run 级折叠**（`execution-outline.ts` + `content-renderer.tsx`）
   - `ToolExecutionRun` 有 `showToggle` 和 `defaultCollapsed`
   - `renderToolRun()` 用 `GenerationProcessLine` + `CollapsibleHeightPanel` 控制
   - `AssistantMessage/index.tsx` 管理 `toolRunCollapseState`（per-run 折叠状态）

2. **消息级折叠**（`action-bar.tsx`）
   - `collapsed` state 控制**整个消息**的折叠/展开
   - collapsed=true 时显示 plainText 的两行预览框
   - 通过 dropdown menu 中的 "Collapse/Expand" 选项触发

### AssistantActionBar (action-bar.tsx, 315行)

包裹 `renderContent()` 输出，底部提供操作按钮（copy/fork/translate/speak/share/retry/delete/collapse）。
`collapsed` true 时用简单文本预览替代完整渲染。

## 关键数据结构

### ContentBlock 类型

```typescript
type ContentBlock =
  | { type: 'thinking', thinking: string, startedAt?, completedAt? }
  | { type: 'text', text: string }
  | { type: 'tool_use', id: string, name: string, input: Record<string, unknown> }
  | { type: 'tool_result', tool_use_id: string, content: ToolResultContent }
  | { type: 'image', source: {...} }
  | { type: 'image_error', code: string, message: string }
  | { type: 'agent_error', ... }
  | { type: 'web_search', ... }
```

### AssistantRenderItem (渲染项)

```typescript
type AssistantRenderItem =
  | { kind: 'block', index: number }           // 单个 block
  | { kind: 'tool-run', runId: string }        // 工具运行组
```

### ToolExecutionRun (工具执行组)

```typescript
interface ToolExecutionRun {
  id: string
  startBlockIndex: number
  endBlockIndex: number
  itemIds: string[]
  ordinaryItemIds: string[]
  forceVisibleItemIds: string[]
  showToggle: boolean      // 是否显示折叠按钮
  defaultCollapsed: boolean
  activeCount: number
  activeSummary: string | null
}
```

## 右侧面板现状

- `RightPanelTabKind`: activity | memory | context | review | files | preview | browser | subagent | terminal（无 workbench）
- `RightPanelTabInstance`: 有 `sessionId` 字段，支持会话级隔离
- 动态 tab 系统已就绪，新增 tab kind 只需扩展类型 + 渲染分支

## ToolCallCard 现状 (ToolCallCard/index.tsx, 570行)

完整工具调用卡片，包含：
- `CompactToolCallHeader` — 工具名/状态/参数摘要
- `StructuredInput` — 输入参数渲染
- output-blocks — 完整输出预览（bash-output / search-output / text-output / memory-output / widget-output）
- `CollapsibleHeightPanel` — 控制输出预览的展开/折叠

**目前没有 compact/full 模式区分，所有预览都在聊天流内。**

## 改造范围确认

本次迭代为**纯渲染层改造**：
- 前端 `content-renderer.tsx`、`AssistantMessage/index.tsx`、`ToolCallCard`、`RightPanel` 改动
- store 数据结构和后端不动
- tool-call-slice 已有 session 级隔离数据，工作台直接复用

## 改造关键点

### 过程 vs 最终文本的分界

一个 AssistantMessage 的 ContentBlock[] 中：
- **过程**：thinking + tool_use/tool-run + 中途 text + compact-summary
- **最终文本**：最后一个 text block（loop 结束后的输出，streaming 中就是当前正在输出的 text）
- **最终输出**：image / image_error / agent_error（这些是 Agent Loop 结束后的生成结果，在最终文本之后或替代最终文本）

分界策略：从后往前找，找到最后一个 text block 或 image/image_error/agent_error block，它之后的就是最终输出部分，之前的就是过程部分。

### collapsible 动态计算

- 过程部分有内容（thinking/tool_use/中途text）→ `collapsible=true`
- 过程部分为空（纯一问一答，只有一个 text block）→ `collapsible=false`
- 执行中（isStreaming）+ collapsible=true → 折叠块展开
- 执行结束（!isStreaming）+ collapsible=true → 折叠块自动折叠成摘要
