# Plan 2: 折叠摘要 + 精简列表展开

## 目标

ExecutionProcessBlock 折叠时显示摘要（"运行了X个命令，查看了X个文件，编辑了X个文件"），点击展开可看精简列表。

## 前置依赖

Plan 1（ExecutionProcessBlock 组件 + 过程/最终文本拆分）

## 步骤清单

- [ ] 步骤1：新建 `process-summary.ts` 工具函数 — 从过程组的 renderItems 中统计工具调用分类（命令/文件读写/搜索/其他），生成摘要文本
  - 验证：给定工具调用列表能正确生成摘要
- [ ] 步骤2：ExecutionProcessBlock 折叠头部渲染摘要 — 复用 `GenerationProcessLine`，detail 字段填入摘要文本
  - 验证：折叠时显示摘要，如"运行了3个命令，查看了2个文件"
- [ ] 步骤3：展开时渲染精简列表 — 过程组内容用精简模式渲染（暂时用现有渲染，Plan 3 再改为 compact ToolCallCard）
  - 验证：点击摘要可展开看过程内容列表
- [ ] 步骤4：用户手动展开/折叠的 state 管理 — 在 ExecutionProcessBlock 内部管理 collapsed state，但初始值跟随 isStreaming（执行中展开，结束后折叠）。用户手动切换后不再自动跟随
  - 验证：执行结束后自动折叠，手动展开后保持展开
- [ ] 步骤5：双编译验证 — `npx tsc --noEmit -p tsconfig.web.json` 零错误
  - 验证：TypeScript 编译通过

## 涉及文件

- `src/renderer/src/components/chat/AssistantMessage/process-summary.ts` — 新建，摘要生成函数
- `src/renderer/src/components/chat/AssistantMessage/execution-process-block.tsx` — 修改，增加摘要渲染和 state 管理

## 设计细节

### 摘要统计逻辑

从 `toolExecutionOutline.items` 按 category 统计：
- `command`（Bash/Shell/PowerShell）→ "运行了X个命令"
- `context`（Read/Grep/Glob/LS/WebFetch/WebSearch）→ "查看了X个文件"
- `file-change`（Write/Edit/Delete）→ "编辑了X个文件"
- 其他 → 按需归类或省略

同时考虑 thinking blocks：有 thinking → "思考了X轮"

### state 管理

```tsx
// ExecutionProcessBlock 内部
const [userToggled, setUserToggled] = useState(false)
const [userCollapsed, setUserCollapsed] = useState(false)

// 实际 collapsed 值
const collapsed = userToggled ? userCollapsed : !isStreaming
```

isStreaming true→false 变化时，如果用户没手动操作过，自动折叠。
