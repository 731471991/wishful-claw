# Plan: 迭代五前端文件拆分

## 背景

迭代五后端文件拆分已完成（AgentLoop / OpenAIChatProvider / Models / ProviderSupport / AnthropicMessages 均已按职责拆分并提交）。前端存在多个超大文件和耦合文件，影响问题定位效率。本计划按优先级逐步拆分前端文件。

**原则**：
- 大文件拆分：200~500 行为宜，拆不动可以不强求
- 耦合文件按职责拆分：不管文件大小，逻辑不相关的代码必须拆开
- 拆分后保持逻辑等价，不改变行为，只改组织结构
- 每步拆完编译验证，通过后提交

## 文件清单（按优先级排序）

| 优先级 | 文件 | 行数 | 问题类型 | 拆分策略 |
|--------|------|------|---------|---------|
| P0 | AssistantMessage.tsx | 3277 | 重复文件 | 已有拆分目录未启用，删旧文件切换 |
| P1 | ToolCallCard.tsx | 3538 | 大文件+耦合 | 按工具输出类型拆子文件 |
| P2 | InputArea/index.tsx | 3378 | 大文件 | 继续从主文件提取逻辑 |
| P3 | MessageList.tsx | 2700 | 大文件 | 按职责提取子组件和工具函数 |
| P4 | FileChangeCard.tsx | 1732 | 大文件+耦合 | 子组件+工具函数拆分 |
| P5 | ModelSwitcher.tsx | 1540 | 大文件 | 子组件拆分 |
| P6 | memory-automation.ts | 1488 | 大文件 | 按管道阶段拆分 |
| P7 | GitPage.tsx | 1444 | 大文件 | 按视图区域拆分 |

> 不拆：routin-ai.ts (1787行，纯数据)、theme-presets.ts (1682行，纯数据)

---

## Step 1: AssistantMessage.tsx — 切换到目录版 (P0)

**现状**：存在两个同名的 AssistantMessage：
- `AssistantMessage.tsx`（3277行）— 旧的单文件版本
- `AssistantMessage/index.tsx`（654行）+ 12个子文件 — 已拆分版本，导出相同的 `AssistantMessage` 组件

`MessageItem.tsx` 的 `import { AssistantMessage } from './AssistantMessage'` 解析到旧文件而非目录。

**操作**：
1. 确认 `AssistantMessage/index.tsx` 的导出与旧文件一致
2. 确认 `AssistantMessage/` 子文件未被旧文件引用（旧文件自带所有逻辑，不依赖子目录）
3. 删除 `AssistantMessage.tsx`（旧文件）
4. 模块解析自动切换到 `AssistantMessage/index.tsx`
5. tsc 编译验证

**风险**：低。两个版本导出相同函数名，删除旧文件后模块解析自动切换。

---

## Step 2: ToolCallCard.tsx — 按输出类型拆分 (P1)

**现状**：3538行，86个函数全堆在一个文件里，包含：
- 工具函数（path/format/error 检测等）
- 多种输出块组件（Read/Shell/Bash/Grep/Glob/LS/Widget/Image/Markdown）
- 输入渲染组件（StructuredInput/EditPayloadPane）
- Compact header 逻辑
- 主组件 ToolCallCardInner + React.memo 导出

**导出**：`ToolCallCard`（memo）、`WidgetOutputBlock`、`ToolStatusDot`

**拆分方案**：

```
components/chat/ToolCallCard/
├── index.tsx                    # 主组件 ToolCallCardInner + React.memo 导出
├── types.ts                     # 接口、类型定义、常量集合
├── utils.ts                     # 纯工具函数（path/format/error/string helpers）
├── output-blocks/
│   ├── read-output.tsx          # ReadOutputBlock + stripReadLineNumbers
│   ├── bash-output.tsx          # BashOutputBlock + LiveShell 相关函数
│   ├── search-output.tsx        # GrepOutputBlock + GlobOutputBlock + LSOutputBlock + 解析函数
│   ├── widget-output.tsx        # WidgetOutputBlock + Widget 相关函数
│   ├── image-output.tsx         # ImageOutputBlock
│   ├── markdown-output.tsx      # MarkdownOutputBlock
│   └── output-block.tsx         # OutputBlock 分发器
├── input-renderers/
│   ├── structured-input.tsx     # StructuredInput + format 函数
│   └── edit-payload-pane.tsx    # EditPayloadPane + InputField
├── compact-header.tsx           # Compact header 模型构建 + 标签 + 图标
└── shared.tsx                   # CopyBtn / ToolDetailSectionHeader / ToolStatusDot 等共享小组件
```

**操作步骤**：
1. 创建 `ToolCallCard/` 目录
2. 创建 `types.ts` — 提取接口和类型
3. 创建 `utils.ts` — 提取纯函数
4. 创建 `output-blocks/` 下各文件 — 按输出类型逐一提取
5. 创建 `input-renderers/` 下各文件
6. 创建 `compact-header.tsx` — 提取 header 逻辑
7. 创建 `shared.tsx` — 提取共享小组件
8. 创建 `index.tsx` — 主组件，import 上述模块
9. 删除旧 `ToolCallCard.tsx`
10. 更新引用方（AssistantMessage 等）的 import 路径
11. tsc 编译验证

---

## Step 3: InputArea/index.tsx — 继续提取 (P2) ✅

**现状**：3378行 → 2722行，提取4个自定义hooks。

**已完成**：
- `use-composer-height.ts`: 拖拽调整、自动高度、布局钳制（全量提取）
- `use-prompt-optimizer.ts`: 提示词优化状态+处理函数（全量提取）
- `use-image-attachments.ts`: 图片附件回调函数（混合模式-state留主组件）
- `use-queued-messages.ts`: 队列状态+回调+effects（全量提取）

commit: 0847ac8

---

## Step 4: MessageList.tsx — 提取子组件和工具函数 (P3) ✅

**现状**：2701行 → 1806行，提取纯工具函数和类型定义到 MessageList/utils.ts (934行)。

commit: c973139

---

## Step 5: FileChangeCard.tsx — 子组件拆分 (P4) ✅

**现状**：1732行 → 1316行，提取纯工具函数和类型到 FileChangeCard/utils.ts (434行)。

commit: 95c8343

---

## Step 6: ModelSwitcher.tsx — 子组件拆分 (P5) ✅

**现状**：1540行 → 1398行，提取纯工具函数和类型到 ModelSwitcher/utils.ts (162行)。

commit: 2f1b653

---

## Step 7: memory-automation.ts — 按管道阶段拆分 (P6) ✅

**现状**：1488行 → 873行，提取56个纯函数/常量/类型到 memory-automation-utils.ts (683行)。
同时修复 MessageList.tsx 语法错误（modeHints缺失闭合括号）、MessageList/utils.ts 缺少export、FileChangeCard 导入错误。

commit: 50a3e80

---

## Step 8: GitPage.tsx — 按视图区域拆分 (P7) ✅

**现状**：1444行 → 1189行，提取类型/纯函数/子组件到 GitPage/utils.tsx (272行)。

commit: a63bee2

---

## 验收标准

- [ ] 每步拆分后 tsc --noEmit 0 错误
- [ ] 每步拆分后 electron-vite build 通过
- [ ] 每步提交独立 commit，message 格式 `refactor(frontend): split XXX`
- [ ] 拆分后行为不变，不修改任何业务逻辑
- [ ] 无残留的旧文件引用
