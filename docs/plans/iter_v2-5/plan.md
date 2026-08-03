# v2-iter-5 实施计划：微信/飞书沟通渠道

## 概述

修复 6 个断裂点，跑通微信和飞书渠道的全链路：消息接收 → 路由 → Agent Loop → 回复发回。

## 实施步骤

### Step 1: Channel 系统初始化（main/index.ts）

在 `src/main/index.ts` 中添加 Channel 系统初始化代码：

1. Import: `ChannelManager`, `registerBuiltInChannelProviders`, `registerChannelHandlers`, `setPluginManager`, `autoStartChannels`
2. 在 `app.whenReady()` 回调中，IPC 注册区域之后：
   - 创建 `ChannelManager` 实例
   - `registerBuiltInChannelProviders(channelManager)` — 注册 8 个渠道工厂
   - `registerChannelHandlers(channelManager)` — 注册所有渠道 IPC 处理器
   - `setPluginManager(channelManager)` — 绑定 auto-reply 流水线
3. 在 `createWindow()` 之后调用 `autoStartChannels(channelManager)` — 自动启动已启用的渠道
4. 在 `app.on('before-quit')` 中调用 `channelManager.stopAll()` — 清理资源

### Step 2: 修复 DB 方法名不匹配（4 处）

在 `src/main/ipc/channel-handlers/channel-plugin-handlers.ts` 中：

| 行号附近 | 修改前 | 修改后 |
|---------|-------|-------|
| ~400 | `db/plugin-sessions-messages` | `db/plugin-session-messages-list` |
| ~409 | `db/plugin-sessions-clear` | `db/plugin-session-messages-clear` |
| ~420 | `db/plugin-sessions-delete` | `db/plugin-session-delete` |
| ~434 | `db/plugin-sessions-rename` | `db/plugin-session-rename` |

### Step 3: 安装飞书 SDK

```bash
npm install @larksuiteoapi/node-sdk
```

### Step 4: 创建渠道自动回复 Hook

新建 `src/renderer/src/hooks/use-channel-auto-reply.ts`：

- 监听 `plugin:session-task` IPC 事件
- 对每个任务：
  1. 确保 session 存在于 chat store（如果不存在则创建）
  2. 从 channel config 或全局默认获取 provider config
  3. 调用 `chatStore.sendMessage()` 触发 Agent Loop
  4. 通过 `agentStream.subscribeAll()` 监听 `loop_end` 事件
  5. `loop_end` 时从 chat store 获取最终文本
  6. 通过 `ipcClient.invoke(IPC.PLUGIN_EXEC, { action: 'sendMessage', ... })` 发回渠道

### Step 5: 在 App.tsx 中挂载 Hook

在 `App` 组件中添加 `useChannelAutoReply()` 调用。

### Step 6: 编译验证

- `npx tsc --noEmit` — TypeScript 零错误
- `dotnet build src/runtime/WishfulClaw.sln` — C# 零错误

### Step 7: 功能测试

- 启动应用，进入设置 → 渠道面板
- 确认 8 个渠道列表显示出来
- 配置微信渠道（QR 扫码绑定）
- 通过微信发消息，验证 Agent 自动回复
- 配置飞书渠道（API 凭据）
- 通过飞书发消息，验证 Agent 自动回复
