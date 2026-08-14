# Plan: v2-iter-13 体验优化六连修

## 目标

修复知识库（`D:\koda\Obsidian\02-AI教学\wishfulclaw`）中记录的 6 个 UI/UX 问题，提升日常使用体验。全部为前端层或 Main 进程 IPC 层改动，不涉及 DB 和后端架构。

## 探索态发现

### 已实现 / 部分实现的项（需确认或补全）

| # | 需求 | 探索发现 |
|---|------|---------|
| 3 | "更改工作文件夹"→"打开工作文件夹" | **i18n 文案已改**（`layout.json:217` changeFolder = "打开工作文件夹"），**handler 已改**（`workspace-sidebar-items.tsx:303` handleChangeFolder 调 `shell:openPath`）。✅ 已完成，仅需验证 |
| 6 | 文件树搜索、刷新按钮 | **搜索按钮已有**（`agent-files-titlebar.tsx:58-66` Search 图标），**刷新在 DropdownMenu 里**（`agent-files-titlebar.tsx:95-98`）。搜索功能存在但可能体验不佳，刷新按钮藏在菜单里不够显眼 |

### 需要修复的项

| # | 需求 | 根因 / 改动点 |
|---|------|--------------|
| 1 | 右键删除文档报错 | **根因**：`use-file-tree-actions.ts:89` 调 `IPC.SHELL_TRASH_PATH`（`shell:trashPath`），但 Main 进程 `index.ts` **未注册该 handler**。需在 Main 注册 `shell:trashPath` → `shell.trashItem()` |
| 2 | 查看/编辑同文件未去重 | `process-summary.ts:buildProcessSummary` 按 category 计数（reads/edits），不按文件路径去重。同一文件被多次 Read 算多次 reads |
| 4 | 底部统计状态移到输入框内左上角 | `ComposerRuntimeStatus` 渲染在 InputArea 底部，需移到输入框内部左上角 |
| 5 | 隐藏文件不显示 | `use-file-tree.ts:loadDir` 调 `FS_LIST_DIR` 获取目录条目，`sortEntries` 不过滤隐藏文件——需确认 Main 进程 `fs:listDir` 是否过滤了 `.` 开头条目 |

## 步骤清单

### 步骤 1：修复右键删除报错（#1）

**改动**：
- `src/main/index.ts` — 注册 `shell:trashPath` IPC handler，调用 Electron `shell.trashItem(fullPath)`
- 前端 `use-file-tree-actions.ts:89` 已调 `IPC.SHELL_TRASH_PATH`，无需改前端

**验证检查点**：
- 右键文件 → 删除 → 确认 → 文件进入回收站，不报错
- 右键文件夹 → 删除 → 确认 → 文件夹进入回收站，不报错
- tsc --noEmit 3/3 PASS

- [ ] 待执行

### 步骤 2：查看/编辑同文件去重合并（#2）

**改动**：
- `src/renderer/src/components/chat/AssistantMessage/process-summary.ts` — `buildProcessSummary` 中对 `reads` 和 `edits` 按 `item.filePath`（或文件标识字段）去重后再计数

**验证检查点**：
- Agent 连续 Read 同一文件 3 次 → 折叠摘要显示"查看了1个文件"而非"查看了3个文件"
- Agent Read 文件A + Read 文件B → 显示"查看了2个文件"
- tsc --noEmit 3/3 PASS

- [ ] 待执行

### 步骤 3：验证"打开工作文件夹"功能（#3）

**改动**：
- 确认 `workspace-sidebar-items.tsx:303` handleChangeFolder 调 `shell:openPath` 打开系统文件管理器
- 确认 i18n 文案已改为"打开工作文件夹"
- 如功能已完整，仅记录验证结果

**验证检查点**：
- 右键项目 → "打开工作文件夹" → 系统文件管理器打开对应目录
- tsc --noEmit 3/3 PASS

- [ ] 待执行

### 步骤 4：底部统计状态移到输入框内部左上角（#4）

**改动**：
- `src/renderer/src/components/chat/InputArea/index.tsx` — 调整 `ComposerRuntimeStatus` 的渲染位置，从底部移到输入框容器内部左上角
- `src/renderer/src/components/chat/InputArea/runtime-status.tsx` — 调整布局样式，适配内嵌显示
- 可能需调整 `composer-editor-area.tsx` 或相关布局文件

**验证检查点**：
- 状态显示在输入框内部左上角，不干扰输入
- 输入框高度自适应，状态不遮挡输入内容
- streaming 时状态正常更新
- tsc --noEmit 3/3 PASS

- [ ] 待执行

### 步骤 5：文件树显示隐藏文件（#5）

**改动**：
- 排查 `src/main` 中 `fs:listDir` handler 是否过滤了 `.` 开头条目
- 如有过滤，去掉过滤或加"显示隐藏文件"开关
- 可能涉及 `src/main/index.ts` 或 `src/main/ipc/` 下的 fs handler

**验证检查点**：
- 文件树加载时显示 `.gitignore`、`.wishful-claw` 等隐藏文件/目录
- tsc --noEmit 3/3 PASS

- [ ] 待执行

### 步骤 6：文件树搜索和刷新按钮优化（#6）

**改动**：
- `src/renderer/src/components/layout/agent-files-titlebar.tsx` — 将刷新按钮从 DropdownMenu 提到 titlebar 直接显示（Search 图标旁边加 RefreshCw 图标按钮）
- 确认搜索功能正常工作

**验证检查点**：
- Files tab 下 titlebar 直接可见搜索 + 刷新按钮
- 搜索点击后展开搜索框，输入文件名过滤
- 刷新点击后文件树重新加载
- tsc --noEmit 3/3 PASS

- [ ] 待执行

## 涉及文件

| 文件 | 改动类型 | 步骤 |
|------|---------|------|
| `src/main/index.ts` | 新增 IPC handler | 1 |
| `src/renderer/src/components/chat/AssistantMessage/process-summary.ts` | 修改去重逻辑 | 2 |
| `src/renderer/src/components/layout/workspace-sidebar-items.tsx` | 验证（可能无需改） | 3 |
| `src/renderer/src/components/chat/InputArea/index.tsx` | 布局调整 | 4 |
| `src/renderer/src/components/chat/InputArea/runtime-status.tsx` | 样式调整 | 4 |
| `src/renderer/src/components/chat/InputArea/composer-editor-area.tsx` | 可能调整 | 4 |
| `src/main/index.ts` 或 `src/main/ipc/` fs handler | 去隐藏文件过滤 | 5 |
| `src/renderer/src/components/layout/agent-files-titlebar.tsx` | UI 调整 | 6 |

## 参考源码

- OpenCowork: `D:\claw\OpenCowork` — 文件树和输入框交互参考
- Electron API: `shell.trashItem()` — 回收站删除标准方式

## 验证标准

1. TypeScript 3/3 配置零错误
2. 6 个问题全部修复或确认已正常
3. 应用启动正常，核心流程不回归
4. 右键删除、文件树搜索/刷新、隐藏文件显示、输入框状态、折叠统计去重 — 逐一验证
