# v2-iter-5 探索报告：微信/飞书沟通渠道

## 目标

跑通微信和飞书沟通渠道，让 Agent 能通过微信/飞书与用户对话。
AI Provider 渠道已完全打通，本次不涉及。

## Channel 系统架构概览

### 后端（main 进程，TypeScript/Electron）

| 文件 | 行数 | 职责 |
|------|------|------|
| `channel-manager.ts` | 110 | 工厂注册模式，管理 service 生命周期（start/stop/restart） |
| `channel-types.ts` | 161 | 核心类型定义（ChannelInstance/ChannelEvent/MessagingChannelService） |
| `channel-descriptors.ts` | 257 | 8 个内置渠道描述符（feishu/dingtalk/wecom/qq/weixin/telegram/discord/whatsapp） |
| `register-providers.ts` | 65 | 懒注册 8 个渠道工厂到 ChannelManager |
| `auto-reply.ts` | 136 | 自动回复流水线：路由消息 → 发 `plugin:session-task` 给前端 |
| `base-plugin-service.ts` | 155 | 抽象基类，处理 WS 生命周期和事件发射 |
| `channel-config-store.ts` | 52 | 通过 Worker DB 读写渠道配置 |
| `ws-transport.ts` | 169 | WebSocket 传输层 |
| `plugin-commands.ts` | 123 | 插件命令解析（/help /new /init /status） |
| `plugin-command-handlers.ts` | 430 | 命令处理逻辑 |
| `providers/weixin/` | ~984 | 微信服务（长轮询模式，不依赖外部 SDK） |
| `providers/feishu/` | ~849 | 飞书服务（依赖 @larksuiteoapi/node-sdk） |

### 前端（renderer 进程）

| 文件 | 行数 | 职责 |
|------|------|------|
| `stores/channel-store.ts` | 138 | 渠道 store：loadChannels/updateChannel/startChannel/stopChannel |
| `components/settings/PluginPanel.tsx` | 96 | 渠道配置面板（左列表 + 右详情） |
| `components/settings/plugin-panel-detail.tsx` | 336 | 渠道详情：QR 绑定/API 凭据/功能设置三 Tab |
| `components/settings/plugin-panel-qr.tsx` | 240 | QR 扫码绑定面板 |

### 后端（C# Worker）

| 文件 | 行数 | 职责 |
|------|------|------|
| `DbPluginSessionTools.cs` | 499 | 插件 session CRUD + 消息列表 |
| `DbPluginSessionRouting.cs` | 195 | 按 pluginId+chatId 路由/创建 session |
| `ChannelConfigModule.cs` | 22 | 渠道配置 IPC 模块 |

## 6 个断裂点

### 1. Channel 系统未在 main/index.ts 初始化（根本原因）

`src/main/index.ts`（508 行）中完全没有 Channel 相关代码：
- 没有 `import ChannelManager`
- 没有 `new ChannelManager()`
- 没有 `registerBuiltInChannelProviders()`
- 没有 `registerChannelHandlers()`
- 没有 `setPluginManager()`（auto-reply.ts 需要）
- 没有 `autoStartChannels()`

**结果**：所有渠道 IPC 调用（`plugin:list`、`plugin:start` 等）都会失败，前端面板"什么都没显示出来"。

### 2. 飞书 SDK @larksuiteoapi/node-sdk 未安装

`feishu-service.ts` 第 1 行 `import * as Lark from '@larksuiteoapi/node-sdk'`，但该包不在 package.json 也不在 node_modules。
飞书渠道启动时会报 MODULE_NOT_FOUND。微信渠道不依赖外部 SDK，可独立工作。

### 3. 前端无 plugin:session-task 事件监听

后端 `auto-reply.ts` 通过 `safeSendMessagePackToAllWindows('plugin:session-task', taskPayload)` 发送任务给前端，
但前端没有任何地方监听这个事件。`PLUGIN_SESSION_TASK` 常量在 channels.ts 定义了，messagepack-channel-routing.ts 注册了路由，
但没有 `ipcClient.on('plugin:session-task', ...)` 调用。

**结果**：渠道消息到达后，auto-reply 路由到 session 成功，但前端不知道要触发 Agent Loop，消息石沉大海。

### 4. Agent 回复未发回渠道

即使 Agent Loop 被触发并生成回复，回复文本也不会被发送回微信/飞书。
需要：在 Agent Loop 结束（`loop_end` 事件）后，获取最终文本，通过 `plugin:exec` → `sendMessage` 发回渠道。

### 5. DB 方法名不匹配（4 处）

前端 `channel-plugin-handlers.ts` 调用的 DB 方法名与后端 `DbModule.cs` 注册的不一致：

| 前端调用 | 后端注册 | 状态 |
|---------|---------|------|
| `db/plugin-sessions-messages` | `db/plugin-session-messages-list` | 不匹配 |
| `db/plugin-sessions-clear` | `db/plugin-session-messages-clear` | 不匹配 |
| `db/plugin-sessions-delete` | `db/plugin-session-delete` | 不匹配 |
| `db/plugin-sessions-rename` | `db/plugin-session-rename` | 不匹配 |

前 4 个方法（list/create/find-by-chat/list-all）名称匹配，只有后 4 个不匹配（复数 vs 单数）。

### 6. 增量模式适配

OpenCowork 的 auto-reply hook（1512 行）是一个完全独立的 Agent Loop 调用路径（`runAgentViaSidecar`），
自行构建 system prompt、provider config、tool definitions 等，与 UI 聊天完全分离。

wishful-claw 已改为后端增量发送模式：`chat-store.sendMessage` → `agent/run` → AgentStreamReceiver。
因此不能直接迁移 OpenCowork 的 auto-reply hook，需要适配为：
- 监听 `plugin:session-task` → 构建 provider config → 调用 `chat-store.sendMessage`
- 通过 `AgentStreamReceiver.subscribeAll` 监听 `loop_end` → 获取最终文本 → `plugin:exec` 发回渠道

## 与 OpenCowork 的三个核心差异

1. **消息构建**：OpenCowork 纯前端构建 → wishful-claw 后端增量发送
2. **渠道配置**：OpenCowork 针对单个项目 → wishful-claw 全局配置（已部分实现，auto-seed 逻辑在 `plugin:list` handler 中）
3. **消息发送**：OpenCowork 使用 sidecar 独立路径 → wishful-claw 复用 `chat-store.sendMessage` + `agent/run`

## 渠道消息流转全链路

```
微信/飞书用户发消息
    ↓
ChannelService.receiveMessage()
    ↓
notifyRenderer(event)  →  safeSendMessagePackToAllWindows('plugin:incoming-message', event)
    ↓                       ↓
前端收到 incoming-message    handleChannelAutoReply(event)
（UI 可选处理）                  ↓
                           db/plugin-route-session（路由到 session）
                               ↓
                           safeSendMessagePackToAllWindows('plugin:session-task', taskPayload)
                               ↓
                           前端 useChannelAutoReply 收到 task
                               ↓
                           chat-store.sendMessage({ sessionId, provider, messages, ... })
                               ↓
                           window.api.workerRequest('agent/run', { ...params, runId })
                               ↓
                           Agent Loop 运行，流式输出
                               ↓
                           AgentStreamReceiver → handleEnvelope → 更新 store
                               ↓
                           loop_end 事件 → auto-reply hook 获取最终文本
                               ↓
                           ipcClient.invoke('plugin:exec', { action: 'sendMessage', ... })
                               ↓
                           ChannelService.sendMessage(chatId, content)
                               ↓
                           微信/飞书用户收到回复
```
