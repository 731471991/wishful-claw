# 规划验证报告：迭代三修复（修订 v2 — 保留 Project）

## 检查结果

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 步骤是否完整覆盖任务目标 | ✅ | 8步覆盖：ui-store → chat-store(Session+Project) → WorkspaceSidebar → TitleBar+FolderDialog → MainLayout → ChatHomePage+ProjectHomePage → 适配 → 验证 |
| 每步是否有明确的验证检查点 | ✅ | 每步都有 typecheck 或 typecheck+build |
| 文件路径是否符合项目结构 | ✅ | 所有文件在 src/renderer/src/ 下 |
| 分层依赖是否正确 | ✅ | 只涉及前端 renderer 层 + preload/main 的 IPC handler |
| 是否参考了正确的源码文件 | ✅ | 直接参考 OpenCowork 7个文件，标注了具体行号 |
| 是否遵循"搬入做减法"原则 | ✅ | 每个步骤都明确了搬入和砍掉清单 |
| Project 功能保留 | ✅ | Session + Project 完整 CRUD，按 Project 分组会话列表，ProjectHomePage，WorkingFolderSelectorDialog（本地） |
| 步骤依赖顺序是否合理 | ✅ | store先行 → 新组件 → 布局整合 → 适配 → 验证 |

## ❌ 阻断项

无。

## 减法原则确认

所有步骤均基于 OpenCowork 源码直接搬入后做减法。关键减法：
- WorkspaceSidebar: 2371行 → ~500行（砍 SSH/搜索/导入导出/排序下拉/拖拽文件夹等）
- chat-store: 5409行 → ~400行（砍 DB持久化/SessionMode/Plugin/Team/Task/Plan/AgentStore等，但保留 Project CRUD）
- ui-store: 2237行 → ~120行（砍 persist/路由/RightPanel/各种页面开关等）
- Layout: 972行 → ~120行（砍动画/多页面路由/ErrorBoundary/CommandPalette）
- WorkingFolderSelectorDialog: 砍 SSH 部分，只保留本地文件夹选择
