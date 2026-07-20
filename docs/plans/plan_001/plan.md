# Plan: 迭代一 — 项目骨架

## 目标

Electron + .NET 工程跑起来，前后端能通过 MessagePack 通信。前端发 "ping"，后端回 "pong"。

## 步骤清单

- [ ] 步骤1：搭建 .NET 解决方案骨架（sln + 4 个 csproj + global.json + .editorconfig）
  - 验证：`dotnet build WishfulClaw.sln` 通过，4 个项目空壳编译成功
  - 项目引用关系：Worker → Core + Workspace + Contracts；Core → Contracts；Workspace → Contracts

- [ ] 步骤2：实现 Contracts 层（接口 + 数据契约）
  - 验证：`dotnet build` 通过
  - 文件：IWorkerModule.cs、IWorkerModuleContext.cs、CommonModels.cs（ErrorResult/StatusResult/WorkerRoutesResult）

- [ ] 步骤3：实现 Core/Protocol 层（MessagePack 通信核心）
  - 验证：`dotnet build` 通过
  - 文件：MessagePackFrameProtocol.cs、MessagePackJsonTranscoder.cs、WorkerMessagePackWriter.cs、WorkerMessagePackEvent.cs、WorkerResponse.cs、WorkerDispatcher.cs、WorkerModuleContext.cs、WorkerRequestContext.cs、WorkerJson.cs、WorkerLog.cs、WorkerJsonContext.cs
  - 从 OpenCowork 搬入，命名空间改为 WishfulClaw.Core.*，可见性改为 public

- [ ] 步骤4：实现 Worker 层（进程入口 + IPC Server + System 模块）
  - 验证：`dotnet build` 通过；`dotnet run --project WishfulClaw.Worker -- --ipc \\.\pipe\wishful-claw-test` 启动并监听
  - 文件：Program.cs、WorkerHost.cs、WorkerHostBuilder.cs、LocalIpcWorkerServer.cs、WorkerEndpoint.cs、SystemModule.cs、WorkerModuleCatalog.cs

- [ ] 步骤5：搭建 Electron + React 前端工程骨架
  - 验证：`npm install` 通过；`npm run typecheck` 通过
  - 文件：package.json、electron.vite.config.ts、tsconfig.json、tsconfig.node.json、tsconfig.web.json、.editorconfig、.npmrc、.prettierrc.yaml

- [ ] 步骤6：实现 Shared 层 + Preload 桥接
  - 验证：`npm run typecheck` 通过
  - 文件：src/shared/messagepack/binary-ipc.ts、src/preload/index.ts、src/preload/index.d.ts

- [ ] 步骤7：实现 Electron Main 进程（窗口 + Worker 管理 + IPC 桥接）
  - 验证：`npm run typecheck:node` 通过
  - 文件：src/main/index.ts、src/main/lib/native-worker.ts、src/main/ipc/messagepack-handler.ts、src/main/window-ipc.ts

- [ ] 步骤8：实现 Renderer（ping/pong 测试页面）
  - 验证：`npm run typecheck:web` 通过；`npm run build` 通过
  - 文件：src/renderer/src/main.tsx、src/renderer/src/App.tsx、src/renderer/src/env.d.ts、src/renderer/index.html、src/renderer/src/assets/main.css

- [ ] 步骤9：全链路集成验证
  - 验证：`dotnet build` 通过 + `npm run dev` 启动 → 点击 ping 按钮 → 看到 pong 响应 → 控制台日志正常
  - 产出：验证日志/截图

## 涉及文件

### .NET 后端

| 文件 | 操作 | 层 |
|------|------|-----|
| `src/runtime/WishfulClaw.sln` | 新建 | — |
| `src/runtime/global.json` | 新建 | — |
| `src/runtime/.editorconfig` | 新建 | — |
| `src/runtime/WishfulClaw.Contracts/WishfulClaw.Contracts.csproj` | 新建 | Contracts |
| `src/runtime/WishfulClaw.Contracts/IWorkerModule.cs` | 新建 | Contracts |
| `src/runtime/WishfulClaw.Contracts/IWorkerModuleContext.cs` | 新建 | Contracts |
| `src/runtime/WishfulClaw.Contracts/CommonModels.cs` | 新建 | Contracts |
| `src/runtime/WishfulClaw.Core/WishfulClaw.Core.csproj` | 新建 | Core |
| `src/runtime/WishfulClaw.Core/Protocol/MessagePackFrameProtocol.cs` | 搬入+改 | Core |
| `src/runtime/WishfulClaw.Core/Protocol/MessagePackJsonTranscoder.cs` | 搬入+改 | Core |
| `src/runtime/WishfulClaw.Core/Protocol/WorkerMessagePackWriter.cs` | 搬入+改 | Core |
| `src/runtime/WishfulClaw.Core/Protocol/WorkerMessagePackEvent.cs` | 搬入+改 | Core |
| `src/runtime/WishfulClaw.Core/Protocol/WorkerResponse.cs` | 搬入+改 | Core |
| `src/runtime/WishfulClaw.Core/Protocol/WorkerDispatcher.cs` | 搬入+改 | Core |
| `src/runtime/WishfulClaw.Core/Protocol/WorkerModuleContext.cs` | 新写（实现 IWorkerModuleContext） | Core |
| `src/runtime/WishfulClaw.Core/Protocol/WorkerRequestContext.cs` | 搬入+改 | Core |
| `src/runtime/WishfulClaw.Core/Protocol/WorkerJson.cs` | 搬入+改 | Core |
| `src/runtime/WishfulClaw.Core/Protocol/WorkerLog.cs` | 搬入+改 | Core |
| `src/runtime/WishfulClaw.Core/Protocol/WorkerJsonContext.cs` | 新写 | Core |
| `src/runtime/WishfulClaw.Workspace/WishfulClaw.Workspace.csproj` | 新建 | Workspace |
| `src/runtime/WishfulClaw.Worker/WishfulClaw.Worker.csproj` | 新建 | Worker |
| `src/runtime/WishfulClaw.Worker/Program.cs` | 搬入+改+精简 | Worker |
| `src/runtime/WishfulClaw.Worker/WorkerHost.cs` | 搬入+改 | Worker |
| `src/runtime/WishfulClaw.Worker/WorkerHostBuilder.cs` | 搬入+改 | Worker |
| `src/runtime/WishfulClaw.Worker/LocalIpcWorkerServer.cs` | 搬入+改+精简 | Worker |
| `src/runtime/WishfulClaw.Worker/WorkerEndpoint.cs` | 搬入+改 | Worker |
| `src/runtime/WishfulClaw.Worker/Modules/SystemModule.cs` | 搬入+改 | Worker |
| `src/runtime/WishfulClaw.Worker/Modules/WorkerModuleCatalog.cs` | 新写（精简） | Worker |

### 前端

| 文件 | 操作 |
|------|------|
| `package.json` | 新建 |
| `electron.vite.config.ts` | 新建 |
| `tsconfig.json` | 新建 |
| `tsconfig.node.json` | 新建 |
| `tsconfig.web.json` | 新建 |
| `.editorconfig` | 新建 |
| `.npmrc` | 新建 |
| `.prettierrc.yaml` | 新建 |
| `src/shared/messagepack/binary-ipc.ts` | 搬入+改 |
| `src/preload/index.ts` | 新写（精简） |
| `src/preload/index.d.ts` | 新写 |
| `src/main/index.ts` | 新写（精简） |
| `src/main/lib/native-worker.ts` | 新写（精简版） |
| `src/main/ipc/messagepack-handler.ts` | 搬入+改 |
| `src/main/window-ipc.ts` | 搬入+改 |
| `src/renderer/index.html` | 新建 |
| `src/renderer/src/main.tsx` | 新写 |
| `src/renderer/src/App.tsx` | 新写（ping/pong 测试页） |
| `src/renderer/src/env.d.ts` | 新建 |
| `src/renderer/src/assets/main.css` | 新建 |

## 参考源码

- OpenCowork: `D:\gy\OpenCowork\sidecars\OpenCowork.Native.Worker\Runtime\*.cs` — MessagePack 帧协议、转码器、分发器、响应构建
- OpenCowork: `D:\gy\OpenCowork\sidecars\OpenCowork.Native.Worker\Hosting\*.cs` — WorkerHost、HostBuilder、ModuleCatalog
- OpenCowork: `D:\gy\OpenCowork\sidecars\OpenCowork.Native.Worker\Modules\SystemModule.cs` — worker/ping、worker/routes
- OpenCowork: `D:\gy\OpenCowork\sidecars\OpenCowork.Native.Worker\Program.cs` — 进程入口
- OpenCowork: `D:\gy\OpenCowork\src\main\lib\native-worker.ts` — Worker 进程管理（精简后参考）
- OpenCowork: `D:\gy\OpenCowork\src\shared\messagepack\binary-ipc.ts` — MessagePack 共享工具
- OpenCowork: `D:\gy\OpenCowork\src\main\ipc\messagepack-handler.ts` — IPC handler 注册
- OpenCowork: `D:\gy\OpenCowork\electron.vite.config.ts` — electron-vite 配置
- OpenCowork: `D:\gy\OpenCowork\package.json` — 依赖列表参考
- OpenCowork: `D:\gy\OpenCowork\tsconfig*.json` — TS 配置参考

## 设计决策

### 1. 分层映射（OpenCowork → Wishful Claw）

OpenCowork 把所有 .NET 代码放在一个 `OpenCowork.Native.Worker` 项目里（全是 `internal`）。Wishful Claw 拆为 4 层：

| OpenCowork 文件 | Wishful Claw 目标 | 可见性变化 |
|-----------------|-------------------|-----------|
| `Runtime/IWorkerModule.cs` | `Contracts/IWorkerModule.cs` | internal → public |
| `Runtime/WorkerModuleContext.cs` | `Core/Protocol/WorkerModuleContext.cs`（实现 Contracts/IWorkerModuleContext） | internal → public |
| `Runtime/WorkerDispatcher.cs` | `Core/Protocol/WorkerDispatcher.cs` | internal → public |
| `Runtime/WorkerResponse.cs` | `Core/Protocol/WorkerResponse.cs` | internal → public |
| `Runtime/MessagePack*.cs` | `Core/Protocol/MessagePack*.cs` | internal → public |
| `Runtime/WorkerJson.cs` | `Core/Protocol/WorkerJson.cs` | internal → public |
| `Runtime/WorkerEndpoint.cs` | `Worker/WorkerEndpoint.cs` | internal → public |
| `Runtime/LocalIpcWorkerServer.cs` | `Worker/LocalIpcWorkerServer.cs` | internal → public |
| `Hosting/*.cs` | `Worker/*.cs` | internal → public |
| `Modules/SystemModule.cs` | `Worker/Modules/SystemModule.cs` | internal → public |
| `Program.cs` | `Worker/Program.cs` | 改 namespace |

新增 `Contracts/IWorkerModuleContext.cs` 接口，让 `IWorkerModule` 不直接依赖 Core 层。

### 2. AOT 策略

迭代一**不启用 AOT**（`PublishAot=false`），简化调试：
- `JsonSerializerIsReflectionEnabledByDefault` 保持默认（true）
- `WorkerJsonContext` 仍保留但简化（后续 AOT 迁移时完善）
- `AllowUnsafeBlocks=true`（MessagePackJsonTranscoder 需要）

### 3. Worker 二进制路径（开发模式）

开发模式下，Electron Main 从 `src/runtime/WishfulClaw.Worker/bin/Debug/net10.0/WishfulClaw.Worker.exe` 找 Worker。
支持环境变量 `WISHFUL_CLAW_WORKER_PATH` 覆盖。

### 4. IPC 端点命名

- Windows: `\\.\pipe\wishful-claw-{pid}-{timestamp}-{uuid}`
- Unix: `/tmp/wishful-claw-{pid}-{timestamp}-{uuid}.sock`

### 5. 前端最小化

迭代一前端只有一个页面：一个 "Ping" 按钮 + 响应显示区。不引入 TailwindCSS、状态管理、路由等（后续迭代再加）。

### 6. native-worker.ts 精简策略

从 OpenCowork 的 1200+ 行精简到 ~300 行：
- 去掉：CodeGraph worker、心跳、自动重启、stderr 捕获、crash log、stale endpoint sweep、power monitor
- 保留：spawn、Named Pipe 连接、帧读写、request/response、event 转发、基本错误处理
