# 探索发现：迭代一 — 项目骨架

> 探索时间：2026-07-20
> 探索范围：wishful-claw 当前状态 + OpenCowork 前端工程结构 + OpenCowork .NET 工程结构 + IPC 通信架构

---

## 一、当前项目状态

### 已有文件

| 文件 | 说明 |
|------|------|
| `AGENTS.md` | 项目结构、分层约定、参考源码路径 |
| `docs/iteration-plan.md` | 8 个迭代计划 |
| `docs/dev-workflow.md` | 六阶段开发工作流 SOP |
| `docs/mvp-scope.md` | MVP 边界 |
| `docs/data-storage.md` | 数据存储设计 |
| `docs/project-structure.md` | 目录结构说明 |
| `docs/project-plan.md` | 项目规划文档 |
| `docs/PROGRESS.md` | 开发进度（全部未开始） |
| `docs/new-session-prompt.md` | 新会话启动提示语 |
| `.gitignore` | 已配置 .NET + Node.js + IDE + OS 规则 |
| `scripts/` | 空目录 |
| `src/main/` `src/preload/` `src/renderer/` `src/shared/` | 空目录 |
| `src/runtime/` 下 4 个项目子目录 | 空目录（无 .csproj / .sln） |

### 缺失项

- **前端**：无 `package.json`、`electron.vite.config.ts`、`tsconfig.json`、任何 `.ts`/`.tsx` 文件
- **后端**：无 `.sln`、无 `.csproj`、无 `global.json`、无任何 `.cs` 文件
- **资源**：无 `resources/` 目录（图标等）
- **配置**：无 `.editorconfig`、无 `.prettierrc`、无 `.npmrc`

### Git 状态

- 分支：`main`，领先 origin 2 个 commit（未 push）
- 最新 commit：`a5e9c30 docs: 新会话启动提示语`
- 工作区干净

---

## 二、OpenCowork 前端工程结构分析

### 构建工具链

| 工具 | 版本/配置 | 说明 |
|------|-----------|------|
| `electron-vite` | — | Electron + Vite 集成构建工具 |
| `@vitejs/plugin-react` | — | React 支持 |
| `@tailwindcss/vite` | v4 | TailwindCSS v4 Vite 插件 |
| `electron-builder` | — | 打包工具 |

### 目录结构

```
src/
├── main/              # Electron Main 进程
│   ├── index.ts       # 主入口（窗口创建、IPC 注册、Worker 启动）
│   ├── lib/
│   │   └── native-worker.ts  # ★ Worker 进程管理器（spawn、IPC、心跳、重启）
│   ├── ipc/
│   │   ├── messagepack-handler.ts  # ★ MessagePack IPC handler 注册器
│   │   ├── process-manager.ts      # 进程管理
│   │   ├── native-agent-runtime.ts # ★ Agent runtime 桥接（renderer → worker）
│   │   └── ...（大量 handler 文件）
│   └── ...
├── preload/
│   └── index.ts       # ★ contextBridge 暴露 window.electron / window.api
├── renderer/
│   └── src/
│       ├── main.tsx   # React 入口
│       ├── App.tsx    # 主应用组件
│       ├── components/  # 大量 UI 组件
│       ├── stores/      # Zustand 状态管理
│       ├── lib/
│       │   └── ipc/
│       │       ├── ipc-client.ts              # ★ Electron IPC 客户端封装
│       │       └── messagepack-ipc-client.ts  # ★ MessagePack 二进制 IPC 客户端
│       └── ...
└── shared/
    └── messagepack/
        └── binary-ipc.ts  # ★ MessagePack 编解码工具（前后端共享）
```

### 关键前端文件

#### `src/shared/messagepack/binary-ipc.ts`

前后端共享的 MessagePack 二进制 IPC 工具：

- `encodeMessagePackPayload(value)` → `Uint8Array`：使用 `@msgpack/msgpack` 编码
- `decodeMessagePackPayload<T>(bytes)` → `T`：解码
- `toMessagePackChannel(channel)` → `string`：通道名加 `:msgpack` 后缀

#### `src/main/ipc/messagepack-handler.ts`

Main 进程的 IPC handler 注册器：

```typescript
ipcMain.handle(toMessagePackChannel(channel), async (event, bytes: Uint8Array) => {
  const args = decodeMessagePackPayload<TArgs>(bytes)
  return encodeMessagePackPayload(await handler(args, event))
})
```

#### `src/preload/index.ts`

通过 `contextBridge` 暴露 API：
- `window.electron`：Electron 标准 API（来自 `@electron-toolkit/preload`）
- `window.api`：自定义 API（通过 `invokeMessagePackBinary` 调用 Main 进程）

#### `src/renderer/src/lib/ipc/messagepack-ipc-client.ts`

Renderer 端的 MessagePack IPC 客户端：
- `invokeMessagePackBinary<T>(channel, payload)` → `Promise<T>`
- 编码 payload → `ipcRenderer.invoke` → 解码 response

### IPC 流转路径（Renderer ↔ Main）

```
Renderer
  → invokeMessagePackBinary(channel, payload)
  → encode(payload) → Uint8Array
  → ipcRenderer.invoke(channel:msgpack, bytes)
  
Main
  → ipcMain.handle(channel:msgpack)
  → decode(bytes) → args
  → handler(args) → result
  → encode(result) → Uint8Array
  → return

Renderer
  → decode(response) → T
```

---

## 三、OpenCowork .NET 工程结构分析

### 项目布局

```
sidecars/
├── OpenCowork.Native.Worker/        # ★ 主 Worker（AOT 发布的可执行文件）
│   ├── OpenCowork.Native.Worker.csproj
│   ├── Program.cs                    # 入口
│   ├── Contracts/
│   │   └── CommonModels.cs           # ErrorResult, StatusResult, WorkerRoutesResult
│   ├── Hosting/
│   │   ├── WorkerHost.cs             # ★ 宿主（封装 IPC Server）
│   │   ├── WorkerHostBuilder.cs      # ★ 构建器（注册模块、创建宿主）
│   │   └── WorkerModuleCatalog.cs    # ★ 默认模块列表
│   ├── Runtime/
│   │   ├── LocalIpcWorkerServer.cs   # ★ IPC 服务器（Named Pipe / Unix Socket）
│   │   ├── MessagePackFrameProtocol.cs    # ★ 帧协议（4字节头 + payload）
│   │   ├── MessagePackJsonTranscoder.cs   # ★ MessagePack ↔ JSON 转码器
│   │   ├── WorkerMessagePackWriter.cs     # ★ 手写 MessagePack 编码器
│   │   ├── WorkerMessagePackEvent.cs      # 事件结构体
│   │   ├── WorkerDispatcher.cs       # ★ 方法分发器（method → handler）
│   │   ├── WorkerEndpoint.cs         # ★ IPC 端点解析（--ipc 参数）
│   │   ├── WorkerModuleContext.cs    # ★ 模块注册上下文
│   │   ├── WorkerRequestContext.cs   # 请求上下文（CancellationToken、事件发射）
│   │   ├── WorkerResponse.cs         # ★ 响应构建器
│   │   ├── IWorkerModule.cs          # ★ 模块接口
│   │   ├── WorkerJson.cs             # JSON 写入工具
│   │   ├── WorkerLog.cs              # 日志
│   │   └── ...
│   ├── Modules/
│   │   ├── SystemModule.cs           # ★ worker/ping, worker/routes, worker/memory
│   │   ├── AgentRuntime/             # Agent 运行时（Provider、Loop、工具执行器）
│   │   ├── FileModule.cs             # 文件操作
│   │   ├── GitModule.cs              # Git 操作
│   │   ├── DbModule.cs               # 数据库操作
│   │   └── ...
│   └── Serialization/
│       └── WorkerJsonContext.cs      # JSON 序列化上下文（AOT 友好）
├── OpenCowork.Worker.Runtime/        # 共享运行时库（CodeGraph worker 复用）
├── OpenCowork.CodeGraph.Core/        # CodeGraph 引擎（不参考）
├── OpenCowork.CodeGraph.Worker/      # CodeGraph Worker（不参考）
└── OpenCowork.CodeGraph.Tests/       # 测试（不参考）
```

### csproj 配置要点

```xml
<OutputType>Exe</OutputType>
<TargetFramework>net10.0</TargetFramework>
<PublishAot>true</PublishAot>              <!-- AOT 发布 -->
<JsonSerializerIsReflectionEnabledByDefault>false</JsonSerializerIsReflectionEnabledByDefault>
<IlcOptimizationPreference>Speed</IlcOptimizationPreference>
<AllowUnsafeBlocks>true</AllowUnsafeBlocks>
<!-- 仅引用 Microsoft.Data.Sqlite + SQLitePCLRaw.bundle_e_sqlite3 -->
```

### Program.cs 入口

```csharp
var endpoint = WorkerEndpoint.Parse(args);  // 解析 --ipc 参数
await WorkerHost.CreateDefault(endpoint).RunAsync();
```

### IPC 通信协议

#### 传输层

- **Windows**：Named Pipe（`\\.\pipe\wishful-claw-native-{id}`）
- **Unix**：Unix Domain Socket（`/tmp/wishful-claw-native-{id}.sock`）
- **帧格式**：4 字节 Big-Endian 长度头 + MessagePack payload
- **最大帧**：256 MB

#### 请求格式（Main → Worker）

MessagePack 编码的 map：
```json
{ "id": 1, "method": "worker/ping", "params": {} }
```

#### 响应格式（Worker → Main）

两种形态：
1. **响应**：`{ "id": 1, "result": <data> }` 或 `{ "id": 1, "error": "msg" }`
2. **事件**（推送）：`{ "event": "agent/stream", "params": { ... } }`

### Worker 进程生命周期（Electron Main 端管理）

`NativeWorkerManager` 类负责：

1. **spawn**：`spawn(workerPath, ['--ipc', endpoint], { windowsHide: true })`
2. **连接**：创建 Named Pipe / Unix Socket 客户端，连接 Worker
3. **握手**：发 `worker/ping` 验证连通性，发 `worker/routes` 验证必需方法
4. **心跳**：定期 `worker/ping`，连续丢失 N 次触发重启
5. **自动重启**：Worker 崩溃后自动重新 spawn + 连接
6. **优雅关闭**：app quit 时 SIGTERM → 等待 → SIGKILL 升级

### Worker 二进制路径解析

开发模式查找顺序：
1. `OPEN_COWORK_NATIVE_WORKER_PATH` 环境变量覆盖
2. `resources/native-worker/` 目录
3. `sidecars/OpenCowork.Native.Worker/bin/Release/net10.0/{rid}/native/`
4. `sidecars/OpenCowork.Native.Worker/bin/Release/net10.0/{rid}/publish/`

打包模式查找：
1. `process.resourcesPath/native-worker/`
2. `process.resourcesPath/resources/native-worker/`
3. `process.resourcesPath/app.asar.unpacked/resources/native-worker/`

### 模块系统

```csharp
// 接口
internal interface IWorkerModule {
    string Name { get; }
    void Register(WorkerModuleContext context);
}

// 注册示例（SystemModule）
context.Register("worker/ping", _ => 
    WorkerResponse.Json(new StatusResult(true, Environment.ProcessId), ...));
context.Register("worker/routes", _ => 
    WorkerResponse.Json(new WorkerRoutesResult(context.GetRegisteredMethods()), ...));
```

### MessagePack 实现策略

OpenCowork **没有使用 MessagePack-CSharp 库**，而是：

1. **C# 端**：手写 `WorkerMessagePackWriter`（手动编码 map/array/string/int）+ `MessagePackJsonTranscoder`（MessagePack ↔ JSON 双向转换，避免反射，AOT 友好）
2. **JS 端**：使用 `@msgpack/msgpack` npm 包
3. **帧层**：`MessagePackFrameProtocol` 负责 4 字节头 + payload 的读写

---

## 四、Wishful Claw 适配分析

### 架构差异

| 方面 | OpenCowork | Wishful Claw |
|------|------------|--------------|
| .NET 项目数 | 1 个（Native.Worker，所有代码混在一起）+ 2 个 CodeGraph | 4 个（Core / Workspace / Worker / Contracts） |
| 分层 | 无严格分层，Runtime + Modules 在同一项目 | Core 不依赖 Workspace；Contracts 接口解耦 |
| AOT | 启用（PublishAot=true） | 迭代一先不启用，用普通 build 简化调试 |
| MessagePack 库 | 手写编码器 + JSON 转码器 | 迭代一搬入同样的手写方案 |
| 前端规模 | 巨大（30+ IPC handler、大量组件） | 迭代一最小化（仅 ping/pong 测试页） |

### 搬入策略

#### 直接搬入（适配命名空间）

| 文件 | 来源 | 目标 | 改动 |
|------|------|------|------|
| `MessagePackFrameProtocol.cs` | OpenCowork.Native.Worker/Runtime/ | WishfulClaw.Core/Protocol/ | 命名空间改 `WishfulClaw.Core.Protocol` |
| `MessagePackJsonTranscoder.cs` | 同上 | 同上 | 同上 |
| `WorkerMessagePackWriter.cs` | 同上 | 同上 | 同上 |
| `WorkerMessagePackEvent.cs` | 同上 | 同上 | 同上 |
| `WorkerJson.cs` | 同上 | 同上 | 同上 |
| `WorkerResponse.cs` | 同上 | 同上 | 同上 |
| `WorkerDispatcher.cs` | 同上 | WishfulClaw.Core/Protocol/ 或 Contracts/ | 命名空间改 + 可见性改 public |
| `IWorkerModule.cs` | 同上 | WishfulClaw.Contracts/ | 命名空间改 + 可见性改 public |
| `WorkerModuleContext.cs` | 同上 | 同上 | 同上 |
| `WorkerEndpoint.cs` | 同上 | WishfulClaw.Worker/ | 命名空间改 |
| `LocalIpcWorkerServer.cs` | 同上 | WishfulClaw.Worker/ | 命名空间改 + 精简（去掉 CodeGraph 相关） |
| `WorkerHost.cs` | 同上 | WishfulClaw.Worker/ | 命名空间改 + 精简 |
| `WorkerHostBuilder.cs` | 同上 | 同上 | 同上 |
| `WorkerRequestContext.cs` | 同上 | WishfulClaw.Core/Protocol/ | 命名空间改 |
| `WorkerLog.cs` | 同上 | 同上 | 命名空间改 |
| `Program.cs` | 同上 | WishfulClaw.Worker/ | 命名空间改 + 精简（去 SSH/CodeGraph） |
| `binary-ipc.ts` | src/shared/messagepack/ | src/shared/messagepack/ | 几乎不改 |
| `messagepack-handler.ts` | src/main/ipc/ | src/main/ipc/ | 几乎不改 |

#### 新写

| 文件 | 目标 | 说明 |
|------|------|------|
| `WishfulClaw.sln` | src/runtime/ | 4 项目解决方案 |
| `WishfulClaw.Core.csproj` | src/runtime/WishfulClaw.Core/ | 类库，无依赖 |
| `WishfulClaw.Contracts.csproj` | src/runtime/WishfulClaw.Contracts/ | 类库，无依赖 |
| `WishfulClaw.Workspace.csproj` | src/runtime/WishfulClaw.Workspace/ | 类库，依赖 Contracts |
| `WishfulClaw.Worker.csproj` | src/runtime/WishfulClaw.Worker/ | Exe，依赖 Core + Workspace + Contracts |
| `native-worker.ts` | src/main/lib/ | 从 OpenCowork 精简（去 CodeGraph、去心跳重启复杂逻辑，迭代一保持简单） |
| `package.json` | 根目录 | 最小依赖 |
| `electron.vite.config.ts` | 根目录 | 最小配置 |
| `tsconfig.json` + `tsconfig.node.json` + `tsconfig.web.json` | 根目录 | TS 配置 |
| `index.ts` | src/main/ | Electron 主进程入口 |
| `index.ts` | src/preload/ | Preload 桥接 |
| `App.tsx` + `main.tsx` | src/renderer/src/ | 最小 React 页面（ping/pong 测试） |

### 潜在风险

1. **.NET 10 SDK**：需确认本机已安装 .NET 10 SDK（OpenCowork 的 `global.json` 要求 `10.0.301`）
2. **AOT vs 普通 build**：OpenCowork 的 MessagePack 实现是为 AOT 设计的（无反射），普通 build 也能工作。但 `JsonSerializerIsReflectionEnabledByDefault=false` 需要 JSON context。迭代一可以简化为 `true`，后续再改
3. **internal 可见性**：OpenCowork 大量使用 `internal`，Wishful Claw 跨项目需要改为 `public`
4. **Worker 二进制路径**：开发模式下需要 `dotnet build` 产出 exe，然后 Electron 找到它。需要约定路径
5. **Named Pipe 命名**：Windows 上管道名不能冲突，需改为 `wishful-claw-` 前缀
6. **MessagePack-CSharp vs 手写**：OpenCowork 手写 MessagePack 是为了 AOT。如果迭代一不用 AOT，可以考虑用 MessagePack-CSharp 库简化。但为保持一致性和后续 AOT 迁移，建议搬入手写方案

---

## 五、参考源码路径索引

### OpenCowork（`D:\gy\OpenCowork`）

| 文件 | 路径 | 参考内容 |
|------|------|---------|
| 前端入口 | `src/main/index.ts` | Electron 主进程结构、窗口创建 |
| Worker 管理器 | `src/main/lib/native-worker.ts` | spawn、IPC 连接、心跳、重启 |
| MessagePack handler | `src/main/ipc/messagepack-handler.ts` | IPC handler 注册模式 |
| Agent runtime 桥接 | `src/main/ipc/native-agent-runtime.ts` | renderer → worker 请求转发 |
| 窗口 IPC | `src/main/window-ipc.ts` | 向 renderer 推送事件 |
| Preload | `src/preload/index.ts` | contextBridge 暴露 API |
| Renderer IPC 客户端 | `src/renderer/src/lib/ipc/messagepack-ipc-client.ts` | invokeMessagePackBinary |
| Renderer IPC 封装 | `src/renderer/src/lib/ipc/ipc-client.ts` | ElectronIPCClient 类 |
| 共享 MessagePack | `src/shared/messagepack/binary-ipc.ts` | 编解码工具 |
| .NET 入口 | `sidecars/OpenCowork.Native.Worker/Program.cs` | Main 函数 |
| .NET IPC Server | `sidecars/OpenCowork.Native.Worker/Runtime/LocalIpcWorkerServer.cs` | Named Pipe / Unix Socket |
| .NET 帧协议 | `sidecars/OpenCowork.Native.Worker/Runtime/MessagePackFrameProtocol.cs` | 4字节头 + payload |
| .NET 转码器 | `sidecars/OpenCowork.Native.Worker/Runtime/MessagePackJsonTranscoder.cs` | MessagePack ↔ JSON |
| .NET MP Writer | `sidecars/OpenCowork.Native.Worker/Runtime/WorkerMessagePackWriter.cs` | 手写 MessagePack 编码 |
| .NET 响应构建 | `sidecars/OpenCowork.Native.Worker/Runtime/WorkerResponse.cs` | Json/String/Error/MP |
| .NET 分发器 | `sidecars/OpenCowork.Native.Worker/Runtime/WorkerDispatcher.cs` | method → handler |
| .NET 模块接口 | `sidecars/OpenCowork.Native.Worker/Runtime/IWorkerModule.cs` | IWorkerModule |
| .NET 模块上下文 | `sidecars/OpenCowork.Native.Worker/Runtime/WorkerModuleContext.cs` | Register 方法 |
| .NET 宿主 | `sidecars/OpenCowork.Native.Worker/Hosting/WorkerHost.cs` | 封装 IPC Server |
| .NET 宿主构建器 | `sidecars/OpenCowork.Native.Worker/Hosting/WorkerHostBuilder.cs` | 模块注册 + 构建 |
| .NET 模块目录 | `sidecars/OpenCowork.Native.Worker/Hosting/WorkerModuleCatalog.cs` | 默认模块列表 |
| .NET System 模块 | `sidecars/OpenCowork.Native.Worker/Modules/SystemModule.cs` | worker/ping, worker/routes |
| .NET Endpoint | `sidecars/OpenCowork.Native.Worker/Runtime/WorkerEndpoint.cs` | --ipc 参数解析 |
| .NET 请求上下文 | `sidecars/OpenCowork.Native.Worker/Runtime/WorkerRequestContext.cs` | CancellationToken + 事件 |
| .NET JSON 工具 | `sidecars/OpenCowork.Native.Worker/Runtime/WorkerJson.cs` | 响应/事件 JSON 写入 |
| .NET JSON 上下文 | `sidecars/OpenCowork.Native.Worker/Serialization/WorkerJsonContext.cs` | AOT JSON 序列化 |
| .NET csproj | `sidecars/OpenCowork.Native.Worker/OpenCowork.Native.Worker.csproj` | AOT 配置 |
| electron-vite 配置 | `electron.vite.config.ts` | Vite + React + TailwindCSS |
| package.json | `package.json` | 依赖列表 |
| TS 配置 | `tsconfig.json` / `tsconfig.node.json` / `tsconfig.web.json` | TypeScript 配置 |
| global.json | `global.json` | .NET SDK 版本 |
| .editorconfig | `.editorconfig` | 编辑器配置 |

### KodaClaw（`D:\gy\koda-claw\koda-claw`）

迭代一不参考（记忆/人格在迭代六/七）。

### OpenClaw.net（`D:\claw\openclaw.net`）

迭代一不参考（记忆主动回忆在迭代六）。
