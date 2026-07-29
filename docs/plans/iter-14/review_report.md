# Review Report: 迭代十四 — Skill 市场

## 审查范围

| 步骤 | 内容 | 状态 |
|------|------|------|
| 步骤1 | SkillModule.cs + SkillCatalog.cs（核心 CRUD） | ✅ 已完成 |
| 步骤2 | SkillScanEngine.cs（安全扫描 + 安装） | ✅ 已完成 |
| 步骤3 | 注册 SkillModule 到 WorkerModuleCatalog | ✅ 已完成 |
| 步骤4 | Main IPC skill-handlers.ts + index.ts | ✅ 已完成 |
| 步骤5 | 后端 E2E 验证（代码级） | ✅ 通过 |
| 步骤6 | ui-types.ts + settings-route.ts 添加 'skills' | ✅ 已完成 |
| 步骤7 | SkillPanel.tsx（初始左右分栏 + BrowserPanel 市场） | ✅ 已完成 |
| 步骤8 | SettingsPage.tsx 添加菜单项和渲染 | ✅ 已完成 |
| 步骤9 | 前端 E2E 验证（代码级） | ✅ 通过 |
| 步骤10 | 悬浮聊天窗替代 InstallDialog | ✅ 已完成 |
| 步骤11 | 选项卡布局（已安装/市场） | ✅ 已完成 |
| 步骤12 | i18n 国际化 + FAB 悬浮按钮 | ✅ 已完成 |
| 步骤13 | 悬浮窗贴右停靠 + 文件拆分（kebab-case） | ✅ 已完成 |
| 步骤14 | Skill 启用/禁用功能 | ✅ 已完成 |
| 步骤15 | 修复 skills:list stub + fs:select-folder null 崩溃 | ✅ 已完成 |
| 步骤16 | 修复从文件夹安装 + 移除留白 | ✅ 已完成 |
| 步骤17 | 悬浮窗会话懒创建（修复默认标题空会话） | ✅ 已完成 |

## 编译验证

| 验证项 | 命令 | 结果 |
|--------|------|------|
| C# 后端 | `dotnet build -o /tmp/wc-build-iter14` | 0 错误, 0 警告 |
| TypeScript 前端 | `npx tsc --noEmit -p tsconfig.web.json` | 0 新增错误（pre-existing 不计） |

## 代码审查

### 后端（C#）

**SkillModule.cs**（31行）
- 注册 13 个方法，命名规范统一 `skills/{action}`
- IWorkerModule 接口实现正确
- 新增 `skills/set-enabled` 通道

**SkillCatalog.cs**（~498行）
- partial class 核心 CRUD：List/Load/Read/ListFiles/Delete/ResolvePath/Save/EnsureBuiltins/EnsureBuiltin
- List 返回 `enabled` 字段
- Skills 目录统一 `~/.agents/skills/`，与 AgentRuntimeSkillExecutor.cs 一致

**SkillCatalogEnabled.cs**（54行）
- partial class：SetEnabled 方法
- 读写 `~/.agents/skills-config.json` 配置文件
- 记录被禁用的 skill 名称列表，不修改 skill 文件本身

**SkillConfigStore.cs**（81行）
- 配置文件读写：LoadDisabledNames / SaveDisabledNames
- JSON 序列化，文件不存在时返回空列表

**SkillScanEngine.cs**（~300行）
- partial class 安全扫描：Scan/AddFromFolder/CleanupTemp
- 风险模式检测完整（危险命令、网络外发、文件系统操作等）
- 所有文件均在 500 行限制内

**WorkerModuleCatalog.cs**
- 正确添加 `using` 和 `new SkillModule()` 注册

### 前端（TypeScript/React）

**skill-handlers.ts**（123行）
- 12 个 IPC handler，全部转发到 Worker
- `skills:open-folder` 正确拆分为 resolve-path + shell.openPath
- `skills:set-enabled` 转发到 Worker
- 超时设置 120s 合理

**skill-panel.tsx**（238行）
- 选项卡布局：已安装 / 市场两个 tab，全宽显示
- FAB 悬浮按钮在右下角，切换 installer 开关
- 悬浮窗在 isOpen 时渲染，sessionId 可为 null（懒创建）
- 传 ensureSession 给 FloatingChatWindow
- 搜索、查看、编辑、删除功能完整
- `useChatActions` hook 正确使用

**floating-chat-window.tsx**（136行）
- 贴右停靠（absolute inset-y-0 right-0）
- 可拖拽调整宽度（320-640px）
- sessionId 为 null 时显示空状态提示
- handleSend 调用 ensureSession() 懒创建会话
- InputArea 使用 'floating-pending' 作为 draftKey 占位

**use-floating-chat-session.ts**（43行）
- 模块级 `_floatingSessionId` 缓存，跨 open/close 复用
- open() 只设置 isOpen=true，不创建 session
- ensureSession() 在首次发送消息时创建会话
- 会话标题设为 "Skill Installer"

**skill-installed-tab.tsx**（135行）
- 已安装列表，含 Switch 启用/禁用开关
- 搜索过滤
- skill 详情查看（文件列表 + SKILL.md 内容）

**skill-detail.tsx**（109行）/ **skill-editor.tsx**（44行）
- skill 详情查看和编辑器，职责分离

**SettingsPage.tsx**
- 新增"扩展"菜单分组，含 Skills 项（Puzzle 图标）
- import 路径改为 kebab-case

**skills-store.ts**
- SkillInfo 添加 `enabled` 字段
- 新增 `toggleSkillEnabled` 方法
- 新增 `addSkillFromFolder` 方法

**skill-tool.ts**
- `refreshSkillTools` 过滤 `enabled === false` 的 skill

### IPC 通道对齐验证

前后端 IPC 通道名称完全匹配（12 个通道）。

## 潜在问题

| # | 问题 | 严重度 | 说明 |
|---|------|--------|------|
| 1 | 运行时 E2E 验证未执行 | 中 | 需启动应用手动测试完整流程 |
| 2 | `_floatingSessionId` 模块级变量在热更新后可能失效 | 低 | 生产环境无 HMR，不影响 |

## 文件清单

### 新建（10 个文件）
1. `src/runtime/WishfulClaw.Worker/Modules/Skills/SkillModule.cs`
2. `src/runtime/WishfulClaw.Worker/Modules/Skills/SkillCatalog.cs`
3. `src/runtime/WishfulClaw.Worker/Modules/Skills/SkillCatalogEnabled.cs`
4. `src/runtime/WishfulClaw.Worker/Modules/Skills/SkillConfigStore.cs`
5. `src/runtime/WishfulClaw.Worker/Modules/Skills/SkillScanEngine.cs`
6. `src/main/ipc/skill-handlers.ts`
7. `src/renderer/src/components/settings/skill-panel.tsx`
8. `src/renderer/src/components/settings/skill-installed-tab.tsx`
9. `src/renderer/src/components/settings/skill-detail.tsx`
10. `src/renderer/src/components/settings/skill-editor.tsx` + `floating-chat-window.tsx` + `use-floating-chat-session.ts`

### 修改（8 个文件）
1. `src/runtime/WishfulClaw.Worker/WorkerModuleCatalog.cs` — 添加 SkillModule 注册
2. `src/main/index.ts` — 替换 stub 为 registerSkillHandlers()，修复 fs:select-folder null 检查
3. `src/renderer/src/stores/ui-types.ts` — 添加 'skills' SettingsTab
4. `src/renderer/src/lib/settings-route.ts` — 类型同步
5. `src/renderer/src/components/settings/SettingsPage.tsx` — 添加菜单项和渲染
6. `src/renderer/src/stores/skills-store.ts` — enabled 字段 + toggleSkillEnabled + addSkillFromFolder
7. `src/renderer/src/lib/tools/skill-tool.ts` — 过滤 disabled skills
8. `src/renderer/src/locales/{zh,en}/settings.json` — skills.* 翻译条目

## Commit 序列

| Commit | 描述 |
|--------|------|
| `bec3d4b` | docs(plan): 规划文档 |
| `afdaea9` | docs(plan): 计划修订 |
| `206156d` | feat(skills): 步骤1+2 |
| `b4045d0` | feat(skills): 步骤3 |
| `d856b2f` | feat(skills): 步骤4 |
| `c5936b7` | feat(skills): 步骤6+7 |
| `1d712ba` | feat(skills): 步骤8 |
| `9295ab9` | docs(review): 审查报告 |
| `0943357` | refactor(skills): 悬浮窗替代InstallDialog |
| `d568a01` | refactor(skills): 选项卡布局 |
| `cfb8004` | refactor(skills): i18n + FAB |
| `db73510` | refactor(skills): 贴右停靠 + 文件拆分 |
| `785fd4a` | feat(skills): 启用/禁用功能 |
| `a8dbf8e` | fix(skills): 移除 skills:list stub |
| `cc3c0fa` | fix(skills): 从文件夹安装 + 移除留白 |
| `2563541` | fix(skills): 悬浮窗会话懒创建 |

## 结论

迭代十四代码实现完成，编译验证通过，IPC 通道对齐验证通过。所有用户反馈的问题已修复：

1. ✅ 选项卡布局（替代左右分栏）
2. ✅ i18n 国际化 + FAB 悬浮按钮
3. ✅ 悬浮窗贴右停靠 + 文件拆分
4. ✅ Skill 启用/禁用功能
5. ✅ 修复 skills:list stub
6. ✅ 修复从文件夹安装无效
7. ✅ 移除多余留白
8. ✅ 悬浮窗会话懒创建（修复默认标题空会话）

待用户启动应用进行运行时 E2E 验证后可进入验证态收尾。
