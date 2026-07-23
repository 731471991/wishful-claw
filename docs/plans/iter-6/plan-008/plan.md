# Plan 6-8: 会话级人格切换 + DB变更

> 前置：Plan 6-1~6-7 已完成。人格系统数据层、PromptBuilder、AgentLoop集成、管理UI、启动选择、AI创建全部就绪。

## 目标

1. sessions 表加 PersonaId 字段，创建会话时写入用户选择的人格 ID
2. 发消息时使用 session 的 personaId（而非全局 defaultPersonaId）
3. 聊天界面 PersonaSwitcher 组件，可在会话中快速切换人格

## 步骤

### 步骤 1: 后端 DB 变更
- SessionEntity 加 PersonaId 字段（TEXT, nullable）
- SessionRow DTO 加 PersonaId
- DbSessionTools: ReadSessionInput + ApplySessionPatch 支持 personaId
- DbClient.Initialize 中加 ALTER TABLE 迁移（CodeFirst 不自动加列）

### 步骤 2: 前端类型 + DB helpers
- Session 类型加 personaId?: string
- db-helpers.ts: SessionRow、rowToSession、dbCreateSession、dbUpdateSession 支持 personaId
- createRestorableSessionSnapshot 复制 personaId

### 步骤 3: use-chat-actions 传 session.personaId
- 从 session 取 personaId，fallback 到 settings.defaultPersonaId
- 传给 sendMessage

### 步骤 4: PersonaSwitcher 组件
- 聊天输入区下拉选择人格
- 切换时更新 session.personaId 并持久化到 DB
- 从 persona-store 获取人格列表

### 验证
- dotnet build 通过
- electron-vite build 通过
- 创建会话→切换人格→发消息→风格不同
