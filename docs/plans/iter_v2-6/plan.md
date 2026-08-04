# v2-iter-6: SSH 远程执行测试与完善

## 探索报告

### 现有 SSH 基础设施（已从 MVP v1 迁移）

**后端 (C#):**
- `AgentRuntimeSshToolExecutor.cs` — 路由 Bash/Shell 到 SSH，支持 toolInput 和 runParameters 两种方式获取 sshConnectionId
- `SshToolProvider.cs` — 注册 `SshListConnections` 工具
- `SshConnectionEntity.cs` — DB 实体 + DTO
- `DbSshTools.cs` — SSH 连接 CRUD
- `ProjectEntity.cs` — 有 `SshConnectionId` 字段
- `PromptBuilder.cs` — 注入 SSH 上下文到 System Prompt（有绑定/无绑定两种提示）
- `ToolDispatchRouter.cs` — 工具路由到 SSH 执行器
- `ShellExecuteTool.cs` — schema 含 `sshConnectionId` 参数

**Main 进程 (TypeScript):**
- `connection-pool.ts` — 连接池（keepalive、指数退避重连、linger 60s 自动关闭）
- `ssh-exec.ts` — `execSshCommand()` 带 `onOutput` 实时输出回调
- `repository.ts` — SSH 配置 CRUD + safeStorage 密码加密
- `auth.ts` — 支持 password / privateKey / agent 三种认证
- `ssh-handlers.ts` — IPC CRUD + exec + test + connect/disconnect
- `ssh-fs-handlers.ts` — SFTP 文件操作（list-dir/read-file/write-file 等）
- `ssh-dao.ts` — 通过 Worker DB 读写
- `reverse-handlers/index.ts` — `ssh:exec` 反向请求，带 `onOutput` → `ssh:exec-output` 广播到前端

**前端 (React):**
- `SshPanel.tsx` — SSH 连接管理设置页
- `SshConnectionDialog.tsx` — 创建/编辑连接对话框
- `AgentSshTerminal.tsx` — 只读 xterm 显示 Agent SSH 实时输出
- `TerminalPanel.tsx` — 终端面板（本地 + ssh-agent tab）
- `terminal-store.ts` — 终端 tab 管理，监听 `ssh:exec-output` 自动创建 Agent SSH tab
- `ssh/` store — 完整的 connections/sessions/explorer/sftp/transfers slice
- `ChatHomePage.tsx` — 项目 SSH 绑定
- `NewSessionProjectSelector.tsx` — 显示 SSH 图标

### 发现的问题

1. **TS 编译错误（pre-existing, from v2-iter-5）**
   - `use-channel-auto-reply.ts:188` — `ThinkingConfig` 类型不匹配
   - 代码 cast 为 `{ type?: string; budget_tokens?: number }`，但实际 `ThinkingConfig` 要求 `bodyParams`
   - 修复：正确 cast 为 `ThinkingConfig | undefined` 并通过 `bodyParams.thinking` 访问

2. **SSH group handlers 缺失**
   - 前端定义了 `ssh:group:list/create/update/delete` IPC 通道
   - `connections-slice.ts` 的 `loadAll()` 调用 `SSH_GROUP_LIST`
   - 但 `ssh-handlers.ts` 中没有注册 group handlers → `loadAll()` 中 `Promise.all` 会静默失败
   - 修复：在 `ssh-handlers.ts` 中注册 group stub handlers（返回空数组），或完整实现

3. **`ssh:disconnect` 是空 stub**
   - 只返回 `{ success: true }`，不实际关闭连接
   - 修复：调用 connection-pool 的 close 方法

4. **TerminalPanel.tsx ssh-agent tab 渲染冗余**
   - `status === 'running'` 和 else 分支渲染相同的 `AgentSshTerminal` 组件
   - 修复：合并为单个条件

5. **ssh-dao.ts SshConnectionRow 缺少 proxy_jump 字段**
   - 前端 types.ts 的 `SshConnectionRow` 有 `proxy_jump`
   - 后端 `SshConnectionEntity` 没有 `proxy_jump` 列
   - 后端 `SshConnectionDbRow` 也不返回 `proxy_jump`
   - 影响：前端 `rowToConnection` 会得到 `undefined`
   - 修复：后端添加 `proxy_jump` 列或在前端 types 中设为可选

6. **`ssh:session:list` 返回空数组**
   - 终端会话是 stub，不影响 Agent SSH 执行功能
   - 但 `loadAll()` 调用此 IPC，返回空数组不影响功能

## Plan 拆分

### Plan 6-1: 修复编译错误 + SSH handlers 补全

**目标**: 修复 TS 编译错误，补全缺失的 SSH IPC handlers，使全链路编译通过且无运行时静默错误。

| 步骤 | 内容 | 文件 |
|------|------|------|
| 1 | 修复 ThinkingConfig 类型错误 | `use-channel-auto-reply.ts` |
| 2 | 注册 ssh:group:* stub handlers（返回空数组 + create/update/delete stub） | `ssh-handlers.ts` |
| 3 | 实现 ssh:disconnect 实际关闭连接 | `ssh-handlers.ts` + `connection-pool.ts` |
| 4 | 修复 TerminalPanel ssh-agent tab 冗余渲染 | `TerminalPanel.tsx` |
| 5 | 添加 proxy_jump 列到 SshConnectionEntity + DbRow（或前端设为可选） | 评估后决定 |
| 6 | 双编译验证 | tsc + dotnet build |

### Plan 6-2: 端到端测试验证

**目标**: 用户手动测试全链路，Agent 修复发现的问题。

| 步骤 | 内容 |
|------|------|
| 1 | SSH 连接创建验证：配置 host/port/user/authType → 密码或密钥认证 → 连接测试通过 |
| 2 | 项目绑定验证：项目设置关联 connectionId → Agent 自动使用 |
| 3 | Agent 远程执行验证：Bash 工具带 sshConnectionId 走 SSH 通道 → 返回结构化 stdout/stderr/exitCode |
| 4 | 终端旁观验证：Agent SSH 执行时终端面板实时显示命令和输出 |
| 5 | 长连接复用验证：多次命令执行复用同一连接 |
| 6 | 修复测试中发现的问题 |
