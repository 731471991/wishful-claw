# 验证报告：迭代一 — 项目骨架

> 验证时间：2026-07-20
> 验证对象：dev/iter-1 分支

---

## 验证项

### 1. .NET 解决方案编译

```
dotnet build WishfulClaw.sln
```

**结果**：✅ PASS
- 4 个项目（Contracts / Core / Workspace / Worker）全部编译成功
- 0 警告 0 错误
- 分层引用关系正确：Worker → Core + Workspace + Contracts；Core → Contracts；Workspace → Contracts

### 2. Worker 进程启动

**结果**：✅ PASS
- Worker 由 Electron 主进程自动 spawn 启动
- 监听 Named Pipe 端点：`\\.\pipe\wishful-claw-{pid}-{timestamp}-{uuid}`
- 日志输出：`server listening transport=named-pipe debug=False slowRequestMs=750`

### 3. 前端 TypeScript 类型检查

```
npm run typecheck:node  # → PASS (0 errors)
npm run typecheck:web   # → PASS (0 errors)
```

**结果**：✅ PASS

### 4. 前端构建

```
npx electron-vite build
```

**结果**：✅ PASS
- Main 进程：52.93 kB
- Preload：44.58 kB
- Renderer：531.24 kB (JS) + 0.25 kB (CSS)

### 5. Worker 二进制构建

```
dotnet build WishfulClaw.Worker/WishfulClaw.Worker.csproj
```

**结果**：✅ PASS
- `WishfulClaw.Worker.exe` 生成成功

### 6. 全链路集成验证（ping → pong）

```
npx electron-vite dev → 点击 "Ping Worker" 按钮
```

**结果**：✅ PASS
- Electron 窗口正常打开，显示 Wishful Claw 界面
- 点击 Ping 按钮后，Worker 进程自动启动
- IPC 连接成功（Named Pipe + MessagePack 帧协议）
- 返回结果：`ok=true, pid=26944`

**验证链路**：
1. Renderer 调用 `window.api.ping()`
2. Preload 通过 `ipcRenderer.invoke('worker/ping:msgpack', bytes)` 发送到 Main
3. Main 的 `registerMessagePackHandler` 解码后调用 `getNativeWorker().request('worker/ping', {})`
4. NativeWorkerManager spawn Worker 进程，连接 Named Pipe，发送 MessagePack 帧
5. Worker 的 `LocalIpcWorkerServer` 接收帧，`WorkerDispatcher` 分发到 `SystemModule`
6. SystemModule 返回 `StatusResult(true, pid)`，经 MessagePack 编码回传
7. Main 解码响应，返回给 Renderer
8. UI 显示 `ok=true, pid=26944`

---

## 修复记录

集成验证过程中修复了以下问题：

| 问题 | 原因 | 修复 |
|------|------|------|
| `electron.app.isPackaged` TypeError | `@electron-toolkit/utils` 在模块顶层访问 `electron.app` | 移除 `@electron-toolkit/utils` 依赖，改用 `!app.isPackaged` |
| `electron.app.whenReady` TypeError | `electron.vite.config.ts` 中 `external: []` 覆盖了 electron 外部化 | 删除 `external: []`，使用 electron-vite 默认配置 |
| Electron 启动了错误的应用 | 环境变量 `ELECTRON_RUN_AS_NODE=1` 和 `ELECTRON_EXEC_PATH` 指向 WPS 灵犀 | 在 `electron.vite.config.ts` 中 `delete process.env.ELECTRON_RUN_AS_NODE` 和 `ELECTRON_EXEC_PATH` |
| Worker IPC 连接 ENOENT | spawn 后立即连接，.NET 进程还未创建 pipe | 实现连接重试机制（200ms 间隔，最多 50 次） |
| Pipe 连接 50 次全部失败 | 前端去掉 `\\.\pipe\` 前缀后传给 `net.createConnection` | 直接传完整 endpoint 路径，参考 OpenCowork 原版实现 |
| 返回 `ok=undefined, pid=undefined` | C# 默认 PascalCase 序列化，前端期望 camelCase | 添加 `JsonNamingPolicy.CamelCase` 到 `WorkerJsonHelper.JsonOptions` |

---

## 已验证的架构

```
┌─────────────────────────────────────────┐
│              Electron (壳)               │
│  ┌────────────┐  ┌───────────────────┐  │
│  │  Renderer   │  │  Main Process     │  │
│  │  (React)    │  │  - 窗口管理        │  │
│  │  - App.tsx  │  │  - IPC 桥接        │  │
│  │  - ping按钮  │←→│  - Worker 管理器   │  │
│  └────────────┘  └───────┬───────────┘  │
│                          │ Named Pipe    │
│                          ↓               │
│  ┌───────────────────────────────────┐  │
│  │  .NET Worker (WishfulClaw.Worker)  │  │
│  │  - IPC Server (Named Pipe)        │  │
│  │  - MessagePack 帧协议              │  │
│  │  - SystemModule (worker/ping)     │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## IPC 通信链路

```
Renderer (App.tsx)
  → window.api.ping()
  → invokeMessagePackBinary('worker/ping', {})
  → encode({}) → Uint8Array
  → ipcRenderer.invoke('worker/ping:msgpack', bytes)

Main (index.ts)
  → ipcMain.handle('worker/ping:msgpack')
  → decode(bytes) → {}
  → getNativeWorker().request('worker/ping', {})
  → encode({id:1, method:'worker/ping', params:{}}) → Named Pipe

Worker (SystemModule)
  → MessagePackFrameProtocol.ReadFrameAsync()
  → ParsedWorkerRequest.Parse() → {method:'worker/ping'}
  → WorkerDispatcher.DispatchAsync('worker/ping', ...)
  → SystemModule handler → WorkerResponse.Json(StatusResult(true, pid))
  → MessagePackFrameProtocol.EncodeResponse() → frame

Main
  → decode(response) → {id:1, result:{ok:true, pid:26944}}
  → resolve(result)
  → encode(result) → Uint8Array
  → return to renderer

Renderer
  → decode(response) → {ok:true, pid:26944}
  → 显示在 UI 上
```

## 最终裁定

**VERDICT: PASS** ✅

迭代一全部 6 项验证通过。Electron + .NET 工程跑起来，前后端通过 Named Pipe + MessagePack 通信，前端发 "ping"，后端回 "pong"（`ok=true, pid=<worker_pid>`）。
