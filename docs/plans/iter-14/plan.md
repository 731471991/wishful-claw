# Plan: 迭代十四 — Skill 市场

## 目标

实现 Skill 的安装/卸载/列表管理和在线市场浏览。

**市场方案**：不走 API 对接，而是在 Skill 设置页面内嵌浏览器指向 `skillhub.cn`。用户浏览市场找到 Skill 后，通过发送提示词给 Agent 完成安装（Agent 用 WebFetch 读取安装说明 + Bash 执行安装到 `~/.agents/skills/`）。

**安装流程示例**：用户在市场浏览器中看到 `find-skill-skillhub`，点击"安装"按钮 → 构造提示词"请根据 https://skillhub.cn/install/skillhub.md，安装 find-skill-skillhub" → 发送到聊天会话 → Agent 用 WebFetch 读取安装说明，用 Bash 工具下载/创建文件到 `~/.agents/skills/find-skill-skillhub/`。

## 验证标准

1. 在设置页面能看到已安装的 Skill 列表
2. 设置页面内嵌浏览器能浏览 skillhub.cn
3. 点击"安装"按钮能构造提示词并发送到聊天会话
4. Agent 通过 WebFetch + Bash 完成安装后，Skill 列表自动刷新
5. 能查看/编辑/删除已安装的 Skill
6. Agent 对话中 Skill 工具能列出已安装的 Skill
7. 卸载 Skill 后 Agent 对话中该 Skill 不可用

## 步骤清单

### Plan 14-1：后端 SkillModule + Main IPC handler

- [ ] 步骤1：创建 `SkillModule.cs` + `SkillCatalog.cs`（核心 CRUD）— 从 OpenCowork 搬入 List/Load/Read/ListFiles/Delete/ResolvePath/Save/EnsureBuiltin(s)，适配命名空间和 `~/.agents/skills/` 目录
  - 验证：`dotnet build` 通过
- [ ] 步骤2：创建 `SkillScanEngine.cs`（安全扫描 + 安装）— 搬入 Scan/AddFromFolder/CleanupTemp + 私有扫描方法
  - 验证：`dotnet build` 通过
- [ ] 步骤3：注册 SkillModule 到 `WorkerModuleCatalog.cs`
  - 验证：`dotnet build` 通过，Worker 启动无异常
- [ ] 步骤4：Main 进程 `skill-handlers.ts` — 从 OpenCowork 搬入 IPC handler（仅本地 CRUD 部分，不含市场 API），替换 index.ts 中的 stub
  - 验证：`npx tsc --noEmit -p tsconfig.web.json` 通过
- [ ] 步骤5：端到端验证 — 手动测试 `skills:list` 返回数据、`skills:add-from-folder` 能安装
  - 验证：应用启动后 skills-store 能加载 skill 列表

### Plan 14-2：前端 Skill 管理设置面板（含内嵌市场浏览器）

- [ ] 步骤6：`ui-types.ts` 添加 `'skills'` SettingsTab
  - 验证：`npx tsc --noEmit -p tsconfig.web.json` 通过
- [ ] 步骤7：创建 `SkillPanel.tsx` — 左右分栏布局：
  - 左侧：已安装 Skill 列表 + 查看/编辑/删除操作
  - 右侧：嵌入式浏览器（复用 BrowserPanel 组件，默认 URL 指向 skillhub.cn）
  - 底部/顶部工具栏：当前浏览器 URL 的"安装此 Skill"按钮 → 构造提示词 → 关闭设置 → 发送到聊天会话
  - 验证：`npx tsc --noEmit -p tsconfig.web.json` 通过
- [ ] 步骤8：`SettingsPage.tsx` 添加 Skills 菜单项和面板渲染
  - 验证：`npx tsc --noEmit -p tsconfig.web.json` 通过，设置页面能打开 Skills tab
- [ ] 步骤9：端到端验证 — 完整流程走通
  - 验证：查看列表 → 浏览市场 → 点安装发提示词 → Agent 安装 → 列表刷新 → Agent 对话可用 → 卸载后不可用

## 涉及文件

### 新建（后端）
- `src/runtime/WishfulClaw.Worker/Modules/Skills/SkillModule.cs` — IWorkerModule 注册
- `src/runtime/WishfulClaw.Worker/Modules/Skills/SkillCatalog.cs` — 核心 CRUD（~200行）
- `src/runtime/WishfulClaw.Worker/Modules/Skills/SkillScanEngine.cs` — 安全扫描 + 安装（~250行）

### 新建（前端）
- `src/renderer/src/components/settings/SkillPanel.tsx` — Skill 管理面板 + 内嵌市场浏览器（~400行）
- `src/main/ipc/skill-handlers.ts` — Main 进程 IPC handler

### 修改
- `src/runtime/WishfulClaw.Worker/WorkerModuleCatalog.cs` — 添加 SkillModule 注册
- `src/main/index.ts` — 替换 skills:list stub 为 registerSkillHandlers()
- `src/renderer/src/stores/ui-types.ts` — 添加 'skills' SettingsTab
- `src/renderer/src/components/settings/SettingsPage.tsx` — 添加 Skills 菜单项和渲染

## 参考源码

- OpenCowork: `D:\claw\OpenCowork\sidecars\OpenCowork.Native.Worker\Modules\Skills\SkillCatalog.cs` — 后端核心逻辑（仅搬本地 CRUD + 扫描部分，不搬市场 API）
- OpenCowork: `D:\claw\OpenCowork\sidecars\OpenCowork.Native.Worker\Modules\Skills\SkillModule.cs` — 模块注册
- OpenCowork: `D:\claw\OpenCowork\src\main\ipc\skills-handlers.ts` — Main 进程 IPC
- OpenCowork: `D:\claw\OpenCowork\src\renderer\src\components\skills\SkillsPage.tsx` — 前端管理页面参考布局
- 已有: `src/renderer/src/components/layout/BrowserPanel.tsx` — 内嵌浏览器组件（直接复用）

## 关键适配点

1. **Skills 目录统一为 `~/.agents/skills/`**（与已有 `AgentRuntimeSkillExecutor.cs` 一致）
2. **不搬市场 API 代码**：砍掉 SkillCatalog 中的 `MarketListAsync` / `DownloadRemoteAsync` / HTTP 辅助方法
3. **前端 skills-store 精简**：已有的市场列表/下载相关 store 逻辑保留但不在设置页面使用（SkillsMenu 下拉菜单可能仍用）
4. **安装流程**：浏览器中点"安装" → 构造提示词 → `closeSettings()` → `navigateToSession()` → `sendMessage()`
5. **命名空间**：全部改为 `WishfulClaw.Worker.Modules.Skills`
6. **Bundled skills**：wishful-claw 没有 `resources/skills/`，`EnsureBuiltins` 处理空目录情况
7. **BrowserPanel 复用**：SkillPanel 内嵌 BrowserPanel 时用独立的 sessionId（如 `'skill-market'`）避免与聊天浏览器状态冲突
