<p align="center">
  <h1 align="center">Wishful Claw</h1>
  <p align="center">
    <strong>Agent 编程软件 — 融合记忆系统与人格系统的桌面 AI 助手</strong><br>
    Agent 有记忆、有人格、能调工具，真正成为你的编程伙伴。
  </p>
</p>

<p align="center">
  <a href="#-why-wishful-claw">Why</a> •
  <a href="#-key-features">Features</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-development-progress">Progress</a> •
  <a href="docs/project-plan.md">Project Plan</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-0.2.12-orange" alt="Version">
  <img src="https://img.shields.io/badge/License-Apache_2.0-blue" alt="License">
  <img src="https://img.shields.io/badge/Status-Private-lightgrey" alt="Status">
</p>

---

## 🚀 Why Wishful Claw?

市面上的 Agent 编程工具各有短板：记忆差、人格粗糙、工具链不全。Wishful Claw 参考四个优秀开源项目的设计，从零构建一个**真正适合自己**的 Agent：

- **有记忆** — 对话前自动检索相关记忆注入，Agent 也能主动读写记忆。关掉重开，记忆还在
- **有人格** — 6 套内置人格预设，切换后输出风格截然不同。人格只在输出层生效，不干扰 Agent 决策
- **能调工具** — 文件读写、Shell 执行、代码搜索，Agent 在你的工作区里直接干活
- **双层架构** — Hot（MEMORY.md 文件）+ SQLite FTS5 全文搜索，实时读写与检索

## ✨ Key Features

### 🧠 记忆系统（Hot + SQLite FTS5）

| 层 | 载体 | 说明 |
|----|------|------|
| **Hot** | `MEMORY.md` 文件 | 活跃记忆，`##` 分段管理，Agent 通过工具实时读写 |
| **持久** | SQLite `memory_entries` 表 + FTS5 | 全文搜索（trigram 分词），Agent 通过工具追加/搜索/更新 |

- **TryInjectRecall** — Agent Loop 开始前自动检索相关记忆注入对话，标注 `untrusted reference data` 防 prompt injection
- **记忆工具** — `memory_append` / `memory_search` / `memory_update` / `memory_hot_read` / `memory_hot_write`，Agent 主动管理
- **ContextBudgetPlanner** — Token × 4 + 字符双限制，自动截断
- **scope 隔离** — 全局 (`~/.wishful-claw/`) + 项目级 (`{工作区}/.wishful-claw/`)

> ⚠️ 温记忆（dormant 文件）、冷记忆（归档表）、分层流转和 HEARTBEAT 语义降级尚未实现，属后续迭代计划。

### 🎭 人格系统

- **Identity + Soul 双层** — 身份定义"我是谁"，灵魂定义"我怎么说话"
- **6 套内置预设** — 极简执行者、深度分析师、创意伙伴、耐心向导、务实顾问、均衡默认
- **PromptBuilder 分段组装** — Base Instruction + Profile Overlay + Context Files + Character Budget
- **会话级切换** — 不同会话可以绑定不同人格
- **AI 辅助创建** — 描述你想要的人格，自动生成 Identity / Soul 文件

### 🧰 工具链

| 类别 | 工具 |
|------|------|
| 文件 | Read / Write / Edit / LS / Glob |
| 代码 | Grep（全文搜索） |
| 终端 | Bash（命令执行） |
| 记忆 | memory_append / memory_search / memory_update / memory_hot_read / memory_hot_write |
| 子 Agent | Task 工具，嵌套上限 2 层 |
| 浏览器 | 内置 webview 浏览器（Navigate / Snapshot / Click / Type） |

### 📦 数据持久化

- **SQLite** — 项目注册、会话历史、消息记录、记忆条目、FTS5 搜索索引，实时写入，重启不丢
- **Markdown 文件** — 人格数据（Identity/Soul）和 Hot 记忆（MEMORY.md）纯文件存储，人可读、可编辑、Git 友好

### 📊 缓存命中率统计

- **后端维护** — SessionConversation 中以原子计数器累计 cache hit / miss tokens，整个会话只增不减
- **全局展示** — 底部状态栏显示会话级全局累计命中率（`Σhit / (Σhit + Σmiss)`），而非单轮值
- **Source 标记** — 每个 usage 事件携带 `usageSource`（executor / planner / subagent / compaction），为后续分拆统计预留

## 🏗️ Architecture

```
Renderer (React 19)  ←→  Preload (contextBridge)  ←→  Main Process  ←→  Native Worker (.NET 10)
     │                                                      │                    │
  UI / 状态管理 / 工具调用展示                          IPC 桥接 / 窗口管理     7 层架构（见下方）
  SubAgentCard / 记忆面板 / 人格切换                     Worker 进程生命周期     Agent Loop / Provider 流式
                                                                               SQLite (SqlSugarCore)
                                                                               记忆检索 / FTS5 索引
                                                                               工具执行 / PromptBuilder
                                                                               缓存计数器 / 上下文压缩
```

### 分层设计（7 层架构）

```
┌──────────────────────────────────────────────────────────────────┐
│  Contracts   — 接口契约（纯接口，无实现）                         │
│  IWorkerModule / IWorkerModuleContext / WorkerResponse            │
├──────────────────────────────────────────────────────────────────┤
│  Core        — Agent 通用框架（不含业务逻辑）                     │
│  Protocol（MessagePack 通信）/ Tools（工具框架基类）              │
├──────────────────────────────────────────────────────────────────┤
│  Infrastructure — 基础设施（Db / Storage / Http）                 │
│  DbClient + Entities / ConfigStore / ProviderStore / HttpClient  │
├──────────────────────────────────────────────────────────────────┤
│  Workspace   — 记忆系统（业务层）                                  │
│  Memory 读写/检索/分层流转/巩固/语义降级/FTS5                      │
├──────────────────────────────────────────────────────────────────┤
│  Persona     — 人格系统                                           │
│  PromptBuilder / PersonaGenerator / PersonaStore / Presets        │
├──────────────────────────────────────────────────────────────────┤
│  Agent       — Agent 运行时（核心业务逻辑）                        │
│  AgentLoop / Provider / Tools / Modules / SubAgent / Compression │
├──────────────────────────────────────────────────────────────────┤
│  Worker      — 进程入口（薄层 IPC 宿主）                           │
│  Program.cs / WorkerHost / WorkerModuleCatalog                    │
└──────────────────────────────────────────────────────────────────┘
```

**核心原则**：

- **分层严格分离** — 各层通过 Contracts 中的接口交互，依赖方向严格自上而下（Contracts → Core → Infrastructure → Workspace → Persona → Agent → Worker）
- **Agent Runtime 和 Workspace 严格分离** — Agent 不直接操作记忆，通过工具调用读写
- **Infrastructure 下沉** — Db/Storage/Http 等通用能力下沉到独立层，Worker 保持薄层（12 文件）
- **记忆必须被用上** — 不靠 System Prompt 全量塞入，Agent 通过工具主动检索读取和实时写入
- **人格在输出时体现** — 不介入 Agent Loop 决策，只在最终输出给用户时加工

## 🛠️ Quick Start

**前置条件：** Node.js ≥ 18, npm ≥ 9, .NET SDK 10

```bash
# 私项目，需授权访问
# 拿到源码后：
cd wishful-claw
npm install
npm run dev
```

### Key Commands

| Command | Description |
| ------- | ----------- |
| `npm run dev` | 启动 Electron + Vite 热重载 |
| `npm run dev:full` | 先编译 .NET Worker 再启动前端 |
| `npm run build` | TypeScript 检查 + 生产构建 |
| `npm run typecheck` | TypeScript 类型检查（main + renderer） |
| `npm run build:worker` | 编译 .NET Worker |

> **数据目录：** `~/.wishful-claw/` — SQLite 数据库 + 全局记忆/人格文件

## 📈 Development Progress

### MVP v1（已完成）

| 迭代 | 版本 | 内容 | 状态 |
|------|------|------|------|
| 一 | v0.1.0 | 项目骨架（Electron + .NET 跑通，IPC 通信） | ✅ |
| 二 | v0.2.0 | AI 服务商 + 模型管理（28 个内置预设） | ✅ |
| 三 | v0.3.0 | Agent Loop + 流式对话 | ✅ |
| 四 | v0.4.0 | 工具链（7 个基础工具 + 工具调用 UI） | ✅ |
| 五 | v0.5.0 | 项目注册 + 会话历史（SQLite 持久化） | ✅ |
| 六 | v0.6.0 | 人格系统（6 套预设 + PromptBuilder + 会话级切换） | ✅ |
| 七 | v0.7.0 | 记忆系统（Hot + SQLite FTS5 + TryInjectRecall + 记忆工具） | ✅ |
| 八 | v0.8.0 | 集成验证（全链路修复 + 日志 + Worker 防崩溃） | ✅ |
| 九 | v0.9.0 | 提示词优化器 + Token 统计修复 | ✅ |
| 十 | v0.10.0 | 子 Agent（Task 工具 + 事件流 + 前端展示） | ✅ |
| 十一 | v0.11.0 | 右侧面板动态 Tab 系统 + 5 个面板 | ✅ |
| 十二 | v0.12.0 | Skill 系统 + 工具清理 | ✅ |
| 十三 | v0.13.0 | 工具 Market + 中文快捷筛选标签 | ✅ |
| 十四 | v0.14.0 | Skill 管理完善 | ✅ |
| 十五 | v0.15.0 | MVP v1 完成（TS 零报错 + 缓存优化 + 工具清理） | ✅ |

### MVP v2 — 架构重构（进行中）

| 迭代 | 版本 | 内容 | 状态 |
|------|------|------|------|
| v2-iter-1 | v2.1.0 | Runtime 分层架构重构 — Agent / Persona 独立，Worker 瘦身 45% | ✅ |
| v2-iter-2 | v2.2.0 | 缓存命中率修复 + LLM 上下文压缩 + 版本号统一 + 7 层架构文档 | ✅ |
| v2-iter-3 | — | Infrastructure 层拆分（Db/Storage/Http 下沉）+ Worker 深度瘦身（12 文件）+ 后端缓存计数器（Reasonix 风格） | ✅ |

## 📁 Project Structure

```
wishful-claw/
├── src/
│   ├── main/                   # Electron Main 进程（窗口管理、IPC 桥接）
│   ├── renderer/               # React 前端（UI / 交互 / 状态管理）
│   ├── preload/                # Electron Preload（安全桥接）
│   ├── shared/                 # 前后端共享类型
│   └── runtime/                # .NET 后端工程（7 层架构）
│       ├── WishfulClaw.sln
│       ├── WishfulClaw.Contracts/        # 1. 接口契约（纯接口）
│       ├── WishfulClaw.Core/             # 2. Agent 通用框架（Protocol + Tools）
│       ├── WishfulClaw.Infrastructure/   # 3. 基础设施（Db / Storage / Http）
│       ├── WishfulClaw.Workspace/        # 4. 记忆系统（Memory + FTS5）
│       ├── WishfulClaw.Persona/          # 5. 人格系统（PromptBuilder + Presets）
│       ├── WishfulClaw.Agent/            # 6. Agent 运行时（Loop / Provider / Tools / Modules）
│       └── WishfulClaw.Worker/           # 7. 进程入口（Program + Host + Catalog）
├── docs/                       # 文档 + 迭代计划
├── scripts/                    # 辅助脚本
└── README.md
```

### 各项目文件数

| 项目 | 文件数 | 职责 |
|------|--------|------|
| Contracts | 4 | 纯接口契约 |
| Core | 19 | Agent 通用框架（Protocol + Tools） |
| Infrastructure | 23 | 基础设施（Db / Storage / Http + Db Tools） |
| Workspace | 12 | 记忆系统（含 MemoryFtsService） |
| Persona | 9 | 人格系统 |
| Agent | 141 | Agent 运行时（Loop / Provider / Executor / Compression / SubAgent / Tools / Modules） |
| Worker | 12 | IPC 宿主（Program + Host + Catalog） |

## 📚 Reference Projects

| 项目 | 参考内容 | 路径 |
|------|---------|------|
| [OpenCowork](https://github.com/AIDotNet/OpenCowork) | Agent Loop、工具链、Provider、流式协议（迁移+重构） | `D:\claw\OpenCowork` |
| [KodaClaw](https://github.com/nekonaka/koda-claw) | 记忆系统、人格系统、PromptBuilder（借鉴思路） | `D:\claw\koda-claw` |
| [OpenClaw.net](https://github.com/nekonaka/openclaw.net) | 记忆主动回忆、记忆工具、上下文预算（借鉴思路） | `D:\claw\openclaw.net` |
| [DeepSeek-Reasonix](https://github.com/deepseek-ai/DeepSeek-Reasonix) | 缓存命中率统计、工具注册发现（借鉴思路） | `D:\claw\DeepSeek-Reasonix` |

> OpenCowork 以该项目为基底迁移代码，经过拆分、适配和命名空间重组后纳入 WishfulClaw 架构；其余三个项目主要借鉴设计思路和架构理念，代码由 WishfulClaw 自行实现。

## 💻 Tech Stack

| 层 | 技术 |
|----|------|
| 前端 | React 19 + TypeScript + Zustand + Tailwind CSS |
| 桌面壳 | Electron 35 + electron-vite |
| 后端 | .NET 10 (C#) |
| 通信 | MessagePack (IPC) |
| 数据库 | SQLite (SqlSugarCore ORM) |
| 记忆 | Markdown 文件 + FTS5 全文搜索 |
| 编辑器 | Monaco Editor |

## 📜 License

项目当前为个人私有项目，尚未开源。

计划采用 [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) 开源，与 [OpenCowork](https://github.com/AIDotNet/OpenCowork) 一致。

---

<div align="center">

自用项目，慢慢打磨。

</div>
