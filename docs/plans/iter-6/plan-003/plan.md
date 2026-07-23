# Plan 6-3: 前端人格管理 UI（全局）

> 前置：Plan 6-1（后端数据层）、Plan 6-2（IPC 端点）已完成。

## 目标

前端 persona-types + persona-store + 设置页 PersonaPanel（全局人格管理），参考 OpenCowork 的 MemoryPanel 模式（tab + Textarea 编辑器），但增加人格列表选择，4 个 tab 对应 4 个 .md 文件。

## 步骤

### ✅ 步骤 1: persona-types.ts ✅
- 创建 `src/renderer/src/lib/persona/persona-types.ts`
- 定义 PersonaSummary、PersonaConfig 接口（与后端 PersonaModels.cs 对齐）
- 定义 PERSONA_FILES 常量数组

### ✅ 步骤 2: persona-store.ts ✅
- 创建 `src/renderer/src/stores/persona-store.ts`
- Zustand store，通过 agentBridge.request 调用 5 个 IPC 端点
- 状态：personaList、selectedPersona、loading、error
- 操作：listPersonas、getPersona、savePersona、deletePersona、applyToProject、selectPersona

### ✅ 步骤 3: PersonaPanel.tsx ✅
- 创建 `src/renderer/src/components/settings/PersonaPanel.tsx`
- 左侧人格列表（卡片样式，显示名称/tagline/内置标签）
- 右侧 4 个 tab（IDENTITY/SOUL/ONTOLOGY/AGENTS）+ Textarea 编辑器
- 保存/重置/删除按钮
- 内置预设显示"内置"标签，不可删除
- 新建人格按钮

### ✅ 步骤 4: 集成到设置页 ✅
- ui-store.ts: SettingsTab 类型加 'persona'
- SettingsPage.tsx: 菜单加人格管理项，内容区渲染 PersonaPanel
- i18n: settings.json 加 persona 相关翻译（中/英）

### 验证 ✅
- tsc 无新增错误（预存546个不相关）
- electron-vite build 通过（13.91s）
- i18n JSON 格式正确
- Commit: 610c74d
