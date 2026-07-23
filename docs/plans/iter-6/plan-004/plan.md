# Plan 6-4: 项目级人格管理 UI

> 前置：Plan 6-3（全局人格管理 UI）已完成，PersonaList 和 PersonaEditor 已拆分为可复用组件。

## 目标

在项目设置页面中添加人格管理面板，结构与全局 PersonaPanel 一致，但操作的是项目人格库（`{projectFolder}/.wishful-claw/personas/`）。额外提供"从全局复制到项目"操作。

## 步骤

### ✅ 步骤 1: 找到项目设置页面入口
- 查看现有项目详情/设置页面的路由和组件结构
- 确定在哪个位置嵌入 PersonaPanel

### ✅ 步骤 2: PersonaPanel 支持 workingFolder 参数
- PersonaPanel 接受可选 workingFolder prop
- 传递给 persona-store 的所有操作（list/get/save/delete）
- 顶部标题/副标题根据作用域动态显示

### ✅ 步骤 3: 项目设置页集成
- 在项目设置/详情页面中嵌入 PersonaPanel，传入 workingFolder
- 添加"从全局复制到项目"按钮（调用 persona/apply-to-project）

### 验证
- electron-vite build 通过
- 项目级面板能独立操作项目人格库
