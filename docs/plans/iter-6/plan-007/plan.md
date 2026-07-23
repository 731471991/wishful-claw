# Plan 6-7: AI 辅助创建人格

> 前置：Plan 6-1~6-6 已完成。后端 PersonaStore + PromptBuilder + AgentLoop 集成就绪，前端管理 UI + 启动选择就绪。

## 目标

用户输入提示词（如"我要一个像老郑那样但更幽默的技术搭档"），后端调用模型 API（单轮，非 Agent Loop）生成 4 个 .md 草稿，前端展示预览，用户可编辑后确认保存到人格库。

## 步骤

### 步骤 1: PersonaGenerator.cs（后端）
- 接收 provider 配置 + 用户提示词 + 可选参考人格 ID
- 用 Bootstrap profile 的 PromptBuilder 构建生成指令
- 调 LLM API（单轮非流式）：OpenAI chat/completions 或 Anthropic messages
- 解析 JSON 响应：{ name, tagline, description, identity, soul, ontology, agents }
- 返回 PersonaConfig 草稿

### 步骤 2: persona/generate 端点（PersonaModule）
- 注册 `persona/generate` 异步端点
- 参数：provider 配置 + prompt + referencePersonaId? + workingFolder?
- 调 PersonaGenerator，返回草稿

### 步骤 3: 前端 persona-store 添加 generatePersona
- 调 `persona/generate` IPC 端点
- 返回草稿 PersonaConfig

### 步骤 4: PersonaGeneratorDialog.tsx 组件
- 对话框：输入提示词 → 调 generatePersona → 预览 4 tab → 用户编辑 → 确认保存
- 可嵌入 PersonaPanel 和 PersonaSelectPage

### 验证
- dotnet build 通过
- electron-vite build 通过
- 输入提示词 → 生成草稿 → 预览 → 保存 → 人格列表出现新人格
