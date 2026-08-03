# Plan: 项目详情页面

## 目标
新建项目详情页面（ProjectDetailPage），集中展示和管理项目的所有配置：工作目录、SSH连接、人格绑定、Provider/Model 绑定、会话列表、项目级记忆。让用户一眼看到项目当前状态，发现配置缺失（如 sshConnectionId 为空），并直接在详情页修改。

## 背景问题
- SSH 项目创建时 sshConnectionId 丢失（已修复 bug，但用户无法从 UI 发现这类问题）
- 项目的人格、Provider/Model 等配置散落在不同入口，没有统一视图
- 缺少项目级信息总览，用户不知道当前项目绑定了什么

## 步骤清单

### 步骤 1：路由 + 空页面骨架
- [ ] ui-store 新增 `chatView: 'detail'` + `navigateToDetail(projectId)` 方法
- [ ] MainLayout switch 加 `case 'detail': return <ProjectDetailPage />`
- [ ] 新建 `ProjectDetailPage.tsx`，读取 activeProject，展示项目名称和基本信息
- **验证**：编译通过，从 ProjectHomePage 或侧边栏点击"项目详情"能跳转到空页面

### 步骤 2：项目信息卡片
- [ ] 展示项目名称（可编辑）、创建时间、更新时间
- [ ] 展示工作目录（本地路径 or SSH 远程），支持点击修改（复用 WorkingFolderSelectorDialog）
- [ ] 展示 SSH 连接信息（连接名称、host、port），如果为空显示警告"未绑定 SSH 连接"
- [ ] 展示项目类型标签（本地项目 / SSH 远程项目）
- **验证**：页面正确显示项目信息，SSH 项目显示连接详情，本地项目显示路径

### 步骤 3：人格绑定卡片
- [ ] 展示当前项目绑定的人格（从 session.personaId 或 settings.defaultPersonaId 读取）
- [ ] 下拉选择器：列出可用人格（全局 + 项目级），支持切换
- [ ] "复制全局人格到项目"按钮：将全局人格复制为项目级
- [ ] "管理人格"链接：跳转到 PersonaPanel
- **验证**：能看到当前人格，能切换人格，能跳转人格管理

### 步骤 4：Provider/Model 绑定卡片
- [ ] 展示项目绑定的 Provider/Model（从 session 或 project 读取，未绑定则显示"继承全局设置"）
- [ ] 下拉选择：Provider 列表 + Model 列表
- [ ] 保存绑定到 project/providerId + project/modelId
- **验证**：能看到当前 Provider/Model，能切换

### 步骤 5：会话列表卡片
- [ ] 列出当前项目下所有会话（从 chatStore.sessions 过滤 projectId）
- [ ] 每条显示标题、消息数、创建时间、最后更新时间
- [ ] 点击会话跳转到会话对话页
- [ ] 显示会话总数统计
- **验证**：正确列出项目下所有会话，点击能跳转

### 步骤 6：记忆概览卡片
- [ ] 调用 memory/stats IPC 获取项目级记忆统计（scope = project:ssh:{projectId} 或 project:{workingFolder}）
- [ ] 展示记忆条目数、各优先级分布
- [ ] "查看记忆"链接：跳转到右侧面板 Memory tab
- **验证**：SSH 项目显示 project:ssh scope 的统计，本地项目显示 project:{folder} 的统计

### 步骤 7：入口集成 + i18n
- [ ] ProjectHomePage 增加"项目详情"按钮
- [ ] WorkspaceSidebar 项目右键菜单或项目卡片增加"详情"入口
- [ ] i18n 中英文翻译
- [ ] 页面顶部返回按钮
- **验证**：从多个入口能进入详情页，返回按钮能回到上一页

## 涉及文件
- `src/renderer/src/components/chat/ProjectDetailPage.tsx` — 新建，项目详情主页面
- `src/renderer/src/components/layout/MainLayout.tsx` — 修改，加路由
- `src/renderer/src/stores/ui-store.ts` — 修改，加 navigateToDetail
- `src/renderer/src/components/chat/ProjectHomePage.tsx` — 修改，加详情入口按钮
- `src/renderer/src/components/layout/WorkspaceSidebar.tsx` — 修改，加详情入口
- `src/renderer/src/stores/chat-store/project-slice.ts` — 可能修改，加 updateProjectPersona 等方法
- `src/renderer/src/locales/*/chat.json` — 修改，加 i18n

## 参考源码
- OpenCowork: `D:\claw\OpenCowork\src\renderer\src\components\chat\ProjectHomePage.tsx` — 项目首页布局参考
- wishful-claw 现有: `ProjectHomePage.tsx` — 已有的项目首页，详情页在其基础上扩展
- wishful-claw 现有: `PersonaPanel.tsx` — 人格管理面板，详情页复用其选择逻辑
- wishful-claw 现有: `WorkingFolderSelectorDialog.tsx` — 目录选择器，详情页复用

## 设计原则
- 单页面，垂直滚动，卡片式布局
- 每个卡片独立一个 section，可折叠
- 配置缺失时显示明显警告（红色/橙色提示）
- SSH 项目和本地项目的展示自适应
