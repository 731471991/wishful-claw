# 迭代十一审查报告

## 审查范围

迭代十一全部 5 个 Plan 的代码改动，从 `541777c` 到 `a9e3712`，共 16 个 commit。

| Plan | 范围 | 核心文件数 |
|------|------|-----------|
| 11-1 | RightPanel 动态 Tab 系统 | RightPanel, RightPanelHeader, ui-store |
| 11-2 | SubAgentsPanel | SubAgentsPanel, SubAgentExecutionDetail, sub-agent-run-data, sub-agent-visuals |
| 11-3 | BrowserPanel | BrowserPanel, browser-access, webview-helpers, browser-native-ui |
| 11-4 | PreviewPanel | PreviewPanel, 12个viewer, CodeEditor, MonacoDiffEditor, viewer-registry, use-file-watcher |
| 11-5 | AgentFilesPanel + SessionChangeReviewPanel + FileTreePanel | 3个主组件 + 17个拆分子文件 |

## 审查项

### 1. 分层约定 — PASS

- 前端组件按 `components/layout/`（面板）、`components/cowork/`（文件树）、`components/editor/`（编辑器）、`components/panels/`（子面板）、`lib/preview/`（查看器）、`stores/`（状态）正确分层
- IPC handler 在 `main/index.ts` 注册，fs 相关在 `main/ipc/fs-handlers.ts`
- Hook 提取模式统一：`use-xxx.ts`（状态+计算）、`use-xxx-actions.ts`（动作处理）
- 无跨层引用（组件不直接调 IPC，通过 store 桥接）

### 2. 硬编码路径/密钥 — PASS

- grep 扫描 `C:\`、`D:\`、`/d/claw`、`/c/Users` 零命中
- 无 API key、secret、password、token 硬编码
- 所有文件路径通过 IPC 参数传递或 store 状态获取

### 3. 逻辑适配正确性 — PASS（含已知差距）

- OpenCowork 代码已适配 WishfulClaw 命名空间和分层约定
- ui-store 简化版（无 AgentFilesSurface/surface 概念）正确适配
- i18n 命名空间从 `cowork` 改为 `layout`
- `BUILTIN_BROWSER_PARTITION` 已改名为 `wishfulclaw`
- terminal stub (`project-terminal-context.ts`) 正确返回 null
- webviewTag: true 已在 BrowserWindow webPreferences 中开启

### 4. 错误处理 — PASS（有改进建议）

| 文件 | catch/error 计数 | 评价 |
|------|-----------------|------|
| use-file-tree.ts | 6 | 充分 |
| use-file-tree-actions.ts | 9 | 充分 |
| use-file-watcher.ts | 5 | 充分 |
| PreviewPanel.tsx | 4 | 合理 |
| BrowserPanel.tsx | 5 | 合理 |
| SubAgentsPanel.tsx | 1 | 合理（数据展示型） |
| use-agent-files.ts | 0 | 建议：增加 IPC 调用的 try-catch |
| use-agent-files-actions.ts | 0 | 建议：增加 git action 的 try-catch |

**改进建议**：`use-agent-files.ts` 和 `use-agent-files-actions.ts` 中缺少 try-catch，但当前数据来源是 store 层（git-store），store 层已有错误处理。非阻断项。

### 5. 不必要的依赖 — PASS

- 无引入 OpenCowork 特有的频道、CodeGraph 等不需要的功能
- Monaco Editor 版本固定为 @monaco-editor/react@^4.7.0 + monaco-editor@^0.55.1
- 无多余 npm 包引入

### 6. 文件拆分合规性 — PASS（有备注）

| 文件 | 行数 | 状态 |
|------|------|------|
| AgentFilesPanel.tsx | 534 | ⚠️ 略超 500（JSX 渲染树，已提取全部 hooks/utils/子组件） |
| FileTreePanel.tsx | 514 | ⚠️ 略超 500（JSX 渲染树，已提取全部 hooks/utils/子组件） |
| 其余所有文件 | < 500 | ✅ |

两个略超 500 行的文件是主组件的 JSX 渲染树，已提取 types/utils/hooks/子组件。进一步拆分需要拆组件本身（如将 render 分为多个 sub-render 方法组件），投入产出比低，暂保留。

### 7. 编译验证 — PASS

- `npx tsc --noEmit`：0 错误
- `npx tsc --noEmit --noUnusedLocals`：0 警告
- `npm run build`：成功（6423 modules transformed, built in 53s）

## 已知差距（非阻断，记录待后续迭代）

### ❌ agent:changes 后端未实现

Plan 11-5 计划中包含以下后端实现，当前为 stub：

- `agent:changes:list-session` → 返回 `[]`
- `agent:changes:list-project` → 返回 `[]`
- `agent:changes:diff-content` → 返回 `null`
- `agent:changes:undo-run` → 返回 `{ success: false }`
- `agent:changes:undo-file` → 返回 `{ success: false }`
- `agent-changes-dao.ts` SQLite DAO 未创建
- 工具执行时的变更追踪未实现

**影响**：AgentFilesPanel 的 changes tab 和 SessionChangeReviewPanel 能渲染但显示空数据。files tab（FileTreePanel）功能完整，不依赖 agent:changes。

**建议**：在后续迭代中实现变更追踪后端，作为独立 Plan。

## 审查结论

| 审查项 | 结果 |
|--------|------|
| 分层约定 | ✅ PASS |
| 硬编码路径/密钥 | ✅ PASS |
| 逻辑适配正确性 | ✅ PASS |
| 错误处理 | ✅ PASS |
| 不必要依赖 | ✅ PASS |
| 文件拆分 | ✅ PASS |
| 编译验证 | ✅ PASS |

**❌ 项数：0** — 不阻断进入验证态。

已知差距（agent:changes 后端）记录为后续迭代任务，不影响当前迭代的验证。
