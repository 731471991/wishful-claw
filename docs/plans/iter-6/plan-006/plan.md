# Plan 6-6: 后端 PromptBuilder + AgentLoop 集成

> 前置：Plan 6-1~6-5 已完成。后端 PersonaStore/PersonaPresetService + IPC 端点就绪，前端管理 UI + 启动选择就绪。

## 目标

参考 KodaClaw 的 PromptBuilder 设计，将 System Prompt 构建从前端迁移到后端。AgentLoop 执行前根据 personaId + workingFolder 读取人格 .md 文件，组装完整 System Prompt。

## 步骤

### ✅ 步骤 1: PromptContextDocument.cs
- 上下文文档模型（path + content），标头格式

### ✅ 步骤 2: PromptProfile.cs
- Profile 定义：Main / Bootstrap

### ✅ 步骤 3: PromptBuilder.cs
- 分段组装：Base Instruction + Session Context + Context Documents（人格 .md）+ Tool Capability + Project Context
- 字符预算截断（WithCharacterBudget）
- 读取人格文件通过 PersonaStore

### ✅ 步骤 4: AgentLoop 集成
- AgentLoop.ExecuteLoopAsync 执行前调 PromptBuilder
- 接收 personaId + workingFolder 参数
- 组装结果写入 provider 的 systemPrompt

### ✅ 步骤 5: 前端集成
- chat-store sendMessage 类型添加 personaId/language/userRules 字段
- use-chat-actions 移除前端 buildSystemPrompt，改为传 personaId/language/userRules 给后端
- electron-vite build 通过

### 验证
- ✅ dotnet build 通过
- ✅ electron-vite build 通过
- 切换人格后同一问题得到风格不同的回答（需运行时验证）

## 状态：已完成 ✅
Commit: 6645580
