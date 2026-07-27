# Plan: Git 工具移植

## 目标

从 OpenCowork 移植 Git 工具链到 wishful-claw，使 Agent 具备版本控制能力（status/diff/log/branch/commit 等）。去掉 SSH 远程仓库支持，只保留本地 Git 操作。

## 步骤清单

- [ ] 步骤1：移植 GitModels.cs — 数据模型（GitExecNativeResult / GitStatusDetailed / NativeGitQueryResult / GitCommitHistoryItem / GitBranchItem 等）
  - 验证：dotnet build 通过
- [ ] 步骤2：移植 GitExecutor.cs — 本地 Git 命令执行引擎（ExecGitLocalAsync + ReadLimitedAsync + TryKill + NormalizeGitError）
  - 从 GitTools.cs 提取执行核心，去掉 SSH 分支
  - 验证：dotnet build 通过
- [ ] 步骤3：移植 GitQueryTools.cs — 查询操作（GetHead / GetRangeCommits / GetChangedFiles / GetStatus / GetFileDiff / GetLineSummary / GetFileDiffAtCommit / GetFileContentAtRef / GetStagedDiffBundle / GetCommitHistory / GetFileHistory / ListBranches）
  - 验证：dotnet build 通过
- [ ] 步骤4：移植 GitStatusTools.cs — 状态解析（StatusDetailed + ParseStatusDetailed + ParseAheadBehind）
  - 验证：dotnet build 通过
- [ ] 步骤5：移植 GitScanTools.cs — 仓库扫描（ScanRepositories，去掉 SSH 远程扫描）
  - 验证：dotnet build 通过
- [ ] 步骤6：创建 GitModule.cs — 模块注册（git/exec-local / git/scan-repositories / git/status-detailed / git/query / git/query-local），去掉 git/exec（SSH 版）
  - 验证：dotnet build 通过
- [ ] 步骤7：注册 GitModule 到 Worker — 在 Worker 入口注册模块
  - 验证：dotnet build 通过 + 启动应用确认模块加载
- [ ] 步骤8：前端 git-store 适配 — 检查现有 git-store.ts 是否需要对接新的 IPC 通道
  - 验证：tsc --noEmit 通过

## 涉及文件

### 新建（后端 Worker）
- `src/runtime/WishfulClaw.Worker/Modules/Git/GitModels.cs` — 数据模型
- `src/runtime/WishfulClaw.Worker/Modules/Git/GitExecutor.cs` — 执行引擎
- `src/runtime/WishfulClaw.Worker/Modules/Git/GitQueryTools.cs` — 查询操作
- `src/runtime/WishfulClaw.Worker/Modules/Git/GitStatusTools.cs` — 状态解析
- `src/runtime/WishfulClaw.Worker/Modules/Git/GitScanTools.cs` — 仓库扫描
- `src/runtime/WishfulClaw.Worker/Modules/Git/GitModule.cs` — 模块注册

### 修改（后端 Worker）
- `src/runtime/WishfulClaw.Worker/Program.cs` 或模块注册入口 — 注册 GitModule

### 可能修改（前端）
- `src/renderer/src/stores/git-store.ts` — 如果需要对接新 IPC 通道

## 参考源码

- OpenCowork: `D:\claw\OpenCowork\sidecars\OpenCowork.Native.Worker\Modules\Git\GitTools.cs`（946 行）— 拆分来源
- OpenCowork: `D:\claw\OpenCowork\sidecars\OpenCowork.Native.Worker\Modules\Git\GitModels.cs`（119 行）— 模型定义
- OpenCowork: `D:\claw\OpenCowork\sidecars\OpenCowork.Native.Worker\Modules\Git\GitModule.cs`（14 行）— 模块注册

## 拆分策略

GitTools.cs（946 行）按职责拆分为 5 个文件：

| 文件 | 职责 | 预估行数 | 来源方法 |
|------|------|---------|----------|
| GitExecutor.cs | 进程执行 + 输出读取 + 错误归一化 | ~180 | ExecGitLocalAsync, ReadLimitedAsync, TryKill, NormalizeGitError |
| GitQueryTools.cs | 12 种查询操作 | ~350 | QueryAsync + 12 个 Get*Async 方法 |
| GitStatusTools.cs | 状态解析 | ~120 | StatusDetailedAsync, ParseStatusDetailed, ParseAheadBehind |
| GitScanTools.cs | 仓库扫描 | ~100 | ScanRepositoriesAsync（去掉 SSH 分支） |
| GitModule.cs | 模块注册 | ~20 | 注册 5 个 IPC 通道（去掉 git/exec SSH 版） |

## 做减法

去掉以下 SSH 相关内容（wishful-claw 暂不需要）：
- `ExecGitAsync` 中的 SSH 分支（`target.IsSsh` 路径）
- `ExecSshShellAsync` 方法
- `ReadRemoteDirectoriesAsync` 方法
- `NormalizeRemoteScanRoot` / `PosixBasename` / `PosixRelative` 方法
- `GitTarget` 中的 `IsSsh` / `SshConnectionId` 字段
- `ReadTarget` 中的 connection 解析
- `git/exec` IPC 通道（SSH 版），只保留 `git/exec-local`
- `GitRepositorySummary` 中的 `SshConnectionId` 字段
