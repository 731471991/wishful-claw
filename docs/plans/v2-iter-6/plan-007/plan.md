# Plan: 项目档案页面（ProjectArchivePage）接入

## 目标
将已存在的 ProjectArchivePage 组件接入 MainLayout 路由，替换当前的 PlaceholderPage 占位。同时确保 SSH 项目的档案页面能正常工作（SSH 项目没有 workingFolder，需要适配）。

## 背景
- ProjectArchivePage.tsx 已从 OpenCowork 完整搬入，代码功能完整
- 依赖的 AutoMemoryPanel、ChannelPanel、memory-files.ts、IPC 通道全部已存在
- 但 MainLayout 中 `case 'archive'` 指向 `<PlaceholderPage>` 而非 `<ProjectArchivePage>`
- SSH 项目没有 workingFolder，档案页面需要适配（当前代码在 `!activeProject?.workingFolder` 时直接显示空模板）

## 步骤清单

### 步骤 1：MainLayout 路由接入
- [ ] 将 `case 'archive'` 的 `<PlaceholderPage>` 替换为 `<ProjectArchivePage />`
- [ ] 确保 import 正确
- **验证**：点击 ProjectHomePage 的"项目档案"按钮，能进入档案页面而非占位页

### 步骤 2：SSH 项目适配
- [ ] ProjectArchivePage 中，SSH 项目（有 sshConnectionId 但无 workingFolder）时，文件路径基于 SSH 连接的 defaultDirectory 或根目录
- [ ] 读取文件时用 SSH IPC（已有逻辑：`activeProject.sshConnectionId ? SSH_FS_READ_FILE : FS_READ_FILE`）
- [ ] 无 workingFolder 时显示提示："SSH 远程项目，文件将存储在远程服务器上"
- **验证**：SSH 项目能进入档案页面，能看到远程文件或模板

### 步骤 3：i18n 补全
- [ ] 检查 `projectArchive.*` 翻译键是否在 zh/en chat.json 中都存在
- [ ] 缺失的补上
- **验证**：中英文切换无遗漏

### 步骤 4：编译验证 + 入口检查
- [ ] tsc 编译通过
- [ ] ProjectHomePage 的"项目档案"按钮入口正常
- [ ] SSH 项目和本地项目都能正常进入档案页面
- **验证**：编译通过，功能正常

## 涉及文件
- `src/renderer/src/components/layout/MainLayout.tsx` — 修改，路由接入
- `src/renderer/src/components/chat/ProjectArchivePage.tsx` — 可能修改，SSH 适配
- `src/renderer/src/locales/*/chat.json` — 可能修改，补全 i18n

## 参考源码
- OpenCowork: `D:\claw\OpenCowork\src\renderer\src\components\chat\ProjectArchivePage.tsx` — 原版参考
- wishful-claw 现有: `src/renderer/src/components/chat/ProjectArchivePage.tsx` — 已搬入的代码
