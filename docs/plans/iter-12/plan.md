# 迭代十二：SSH 远程执行 + Agent 终端旁观

## 目标

Agent 能通过 SSH 连接到远程服务器执行命令，连接配置持久化复用，执行过程实时输出到终端面板供用户旁观。

## 核心需求

- 用户配置一次 SSH 连接（host/user/密钥/密码），后续 Agent 自动复用，不需要重复认证
- Agent 调用 Bash 工具带 `sshConnectionId` 时，走 SSH 通道在远程服务器上执行
- 执行返回结构化结果（stdout/stderr/exitCode）给 Agent
- 执行过程实时推送到终端面板，用户可以旁观 Agent 的操作过程

## Plan 拆分

### Plan 12-1：SSH 连接管理基础设施

**目标**：建立 SSH 连接的存储、认证和连接池管理。

| 步骤 | 内容 | 文件 |
|------|------|------|
| 1 | 安装 `ssh2` + `@types/ssh2` npm 依赖 | `package.json` |
| 2 | DB 建表 — `ssh_connections` 表 | `DbClient.cs` |
| 3 | Worker SSH DB CRUD — 搬入 `DbSshModels.cs` + `DbSshTools.cs`，适配 SqlSugar | `Modules/Db/DbSshTools.cs` |
| 4 | Main 进程 SSH 连接管理 — 搬入 `connection-manager.ts`（精简版），保留 `withSshConnection()` + `execSshCommand()` | `src/main/ssh/connection-manager.ts` |
| 5 | Main 进程 SSH 认证 — 搬入 `auth.ts`（精简版，去掉 proxy jump），保留 `buildConnectConfig()` | `src/main/ssh/auth.ts` |
| 6 | Main 进程 SSH 仓库 — 搬入 `repository.ts`，密码用 `safeStorage` 加密 | `src/main/ssh/repository.ts` |
| 7 | Main 进程 SSH DAO — 搬入 `ssh-dao.ts`（通过 Worker DB 读写） | `src/main/db/ssh-dao.ts` |
| 8 | Main 进程 SSH IPC 注册 — 注册 `ssh:connection:list/create/update/delete` + `ssh:exec` + `ssh:connect` + `ssh:disconnect` | `src/main/ipc/ssh-handlers.ts` |
| 9 | 移除 `ssh:connection:list` stub handler | `src/main/index.ts` |
| 10 | MessagePack 通道路由 — 确认 `ssh:*` 通道在白名单中 | `messagepack-channel-routing.ts` |

**验证**：tsc + dotnet build 通过。能通过 IPC 创建 SSH 连接记录、建立 ssh2 连接、执行远程命令拿到 stdout。

### Plan 12-2：Agent SSH 工具执行器

**目标**：Agent 调用 Bash 工具时，如果带有 `sshConnectionId`，自动走 SSH 通道远程执行。

| 步骤 | 内容 | 文件 |
|------|------|------|
| 1 | Worker SSH 工具执行器 — 搬入 `AgentRuntimeSshToolExecutor.cs`（精简版） | `AgentRuntime/AgentRuntimeSshToolExecutor.cs` |
| 2 | Worker SSH 协议桥接 — Main 进程收到 Worker 的 SSH 执行请求，转发到 `execSshCommand()` | `src/main/ipc/ssh-handlers.ts` |
| 3 | ToolCallProcessor 集成 — 工具调用时检测 `sshConnectionId` 参数，路由到 SSH 执行器 | `AgentRuntime/ToolCallProcessor.cs` |
| 4 | 系统提示词引导 — 告知 Agent 项目绑定了 SSH 连接 | `Persona/PromptBuilder.cs` |
| 5 | 项目 SSH 绑定 — 项目可关联 SSH 连接 ID，Agent 自动使用 | `DbProjectTools.cs` |

**验证**：配置 SSH 连接 → 项目绑定 → 对 Agent 说"查看服务器 CPU"→ Agent 远程执行命令 → 返回结构化结果。

### Plan 12-3：Agent 终端旁观模式

**目标**：Agent 通过 SSH 执行命令时，执行过程实时输出到终端面板。

| 步骤 | 内容 | 文件 |
|------|------|------|
| 1 | execSshCommand 增加实时输出回调 | `src/main/ssh/connection-manager.ts` |
| 2 | IPC 事件 `ssh:exec-output` — 推送实时输出 chunk | `channels.ts` |
| 3 | TerminalPanel 增加 Agent 旁观 tab — 只读 xterm | `TerminalPanel.tsx` |
| 4 | 命令执行开始/结束标记 | 同上 |
| 5 | 自动切换到 Agent tab | `TerminalPanel.tsx` + `ui-store` |

**验证**：Agent SSH 执行时，终端面板自动出现 Agent tab，实时显示命令和输出。

### Plan 12-4：SSH 连接管理 UI

**目标**：前端提供 SSH 连接的增删改查界面。

| 步骤 | 内容 | 文件 |
|------|------|------|
| 1 | SSH 连接管理面板 | `components/ssh/` |
| 2 | SSH 连接创建/编辑表单 | `components/ssh/SshConnectionDialog.tsx` |
| 3 | 项目设置中绑定 SSH 连接 | `components/settings/` |
| 4 | 密码加密存储 | `src/main/ssh/repository.ts` |
| 5 | 连接测试 | `src/main/ssh/auth.ts` |

**验证**：设置页面添加 SSH 连接 → 测试连通性 → 项目绑定 → Agent 自动使用。

## 技术要点

- **长连接复用**：`connection-manager.ts` 维护 `Map<connectionId, ssh2.Client>` 连接池，keepalive 保活，断线自动重连
- **结构化返回**：`client.exec()` 非交互式执行，等 `close` 事件拿 stdout/stderr/exitCode
- **实时旁观**：`stream.on('data')` 的 chunk 同时推送到前端终端面板（只读 xterm），不影响结构化收集
- **密码安全**：密码/密钥短语用 Electron `safeStorage` 加密后存 DB，明文不出 main 进程
- **精简范围**：不搬 SFTP 文件传输、SSH 终端（SshTerminal）、端口转发、proxy jump、OpenSSH config 导入
- **参考来源**：OpenCowork `src/main/ssh/`（connection-manager/auth/repository/sftp-service）+ `AgentRuntimeSshToolExecutor.cs`
