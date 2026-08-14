# 规划验证报告 — v2-iter-13

## 审查结果

| 审查项 | 结果 | 说明 |
|--------|------|------|
| 步骤完整性 | ✅ | plan.md 列出 6 个步骤，逐一覆盖知识库中 6 个 UI/UX 问题：#1 右键删除报错、#2 查看/编辑去重、#3 打开工作文件夹、#4 统计状态移位、#5 隐藏文件不显示、#6 搜索/刷新按钮优化。全部对齐，无遗漏。 |
| 验证检查点 | ✅ | 每步均有明确的验证条件（功能行为描述 + `tsc --noEmit 3/3 PASS`）。Step 1 区分文件/文件夹场景，Step 2 覆盖单次 vs 多次文件，Step 4 覆盖自适应高度/streaming，验证维度充足。 |
| 文件路径 | ✅ | 8 个涉及文件路径全部与实际项目结构一致：`src/main/index.ts`、`src/renderer/src/components/chat/AssistantMessage/process-summary.ts`、`src/renderer/src/components/layout/workspace-sidebar-items.tsx`、`src/renderer/src/components/chat/InputArea/index.tsx`、`src/renderer/src/components/chat/InputArea/runtime-status.tsx`、`src/renderer/src/components/chat/InputArea/composer-editor-area.tsx`、`src/main/ipc/` fs handler、`src/renderer/src/components/layout/agent-files-titlebar.tsx`——均已通过 Glob 确认存在。 |
| 分层依赖 | ✅ | 全部改动集中在 Electron Main 进程（IPC handler 注册）与 React 渲染进程（组件布局/UI 逻辑），均不涉及 .NET 后端 7 层架构（Contracts / Core / Infrastructure / Workspace / Persona / Agent / Worker），不存在跨层依赖风险。Step 1 注册 IPC handler 属 Main 进程职责，符合架构。 |
| 参考源码 | ✅ | 参考源码路径 `D:\claw\OpenCowork` 与 AGENTS.md 中声明的 OpenCowork 路径完全一致。引用的 Electron API `shell.trashItem()` 是官方标准方式。 |
| 探索态发现 | ✅ | 经源码逐项核实：①#3 `workspace-sidebar-items.tsx:303` `handleChangeFolder` 确实调用 `ipcClient.invoke(IPC.SHELL_OPEN_PATH, project.workingFolder)`（第 303-310 行），i18n 文案已改——**"已实现"判断准确**；②#6 `agent-files-titlebar.tsx:58-66` 存在 Search 图标按钮，`agent-files-titlebar.tsx:95-98` 刷新在 DropdownMenu 里——**"部分实现"判断准确**；③#1 确认 `IPC.SHELL_TRASH_PATH` 在前端已引用（`use-file-tree-actions.ts`、`channels.ts`），但 Main 进程无任何 trash handler——**根因定位准确**；④#5 确认 `src/main/ipc/fs-handlers.ts` 存在，`use-file-tree.ts` 存在，plan.md 对根因的"需排查确认"表述合理。 |
| plan.md 格式 | ✅ | 遵循 dev-workflow.md 阶段二 plan.md 格式要求：包含标题 `# Plan: v2-iter-13`、`## 目标`、`## 步骤清单`（每步带 `- [ ] 待执行` checkbox 和验证检查点）、`## 涉及文件`、`## 参考源码`。额外包含"探索态发现"和"验证标准"章节，属于合理扩展。 |
| 步骤依赖顺序 | ✅ | 6 个步骤均为独立改动，互不依赖：① Main IPC handler、② 折叠摘要去重、③ 仅验证、④ 输入框布局、⑤ fs:listDir 过滤、⑥ titlebar UI。可按任意顺序执行，无阻塞关系。Step 3（仅验证）可最早完成。 |

## ❌ 项详情

无不合规项。

### 建议性优化（非阻断）

1. **Step 1 验证标准中"tsc --noEmit 3/3 PASS"可更明确**：plan.md 各处写 `tsc --noEmit 3/3 PASS`，与 AGENTS.md 要求（`tsconfig.web.json` + `tsconfig.node.json` + `tsconfig.json` 三配置）一致，建议在执行时显式注明三个 `-p` 参数，避免遗漏。

2. **Step 2 去重字段需确认**：`process-summary.ts` 当前按 `item.category` 计数（第 63-65 行 `counts[classifyItem(item)] += 1`），plan.md 指出需按 `item.filePath` 去重。需在执行时确认 `ToolExecutionItem` 中 `reads`/`edits` 类型项的字段名确为 `filePath`（或等价字段），以便准确实现去重逻辑。

3. **Step 5 需先完成根因确认再定方案**：plan.md 已明确标注"需确认 Main 进程 `fs:listDir` 是否过滤了 `.` 开头条目"，执行时建议先读完 `src/main/ipc/fs-handlers.ts` 中 listDir handler 的完整实现，再决定"去掉过滤"还是"加开关"。

4. **Step 4 涉及多个布局文件**：plan.md 已标注"可能需调整 `composer-editor-area.tsx` 或相关布局文件"，执行时需注意 `InputArea` 已拆分为多个模块（`use-input-area-effects.ts`、`use-input-area-selectors.ts`、`composer-toolbar.tsx` 等），按 AGENTS.md AI 排查规范需关注拆分出的 hooks/effects 文件。

## 结论

**PASS**

8 项审查全部通过（❌ 项 = 0），plan.md 符合项目规范，可进入用户确认环节。