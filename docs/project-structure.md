# Wishful Claw 项目结构

```
wishful-claw/
├── package.json                          # Electron + 前端工程根
├── electron.vite.config.ts
├── src/
│   ├── main/                             # Electron Main 进程（TS）
│   ├── renderer/                         # React 前端（TS）
│   ├── preload/                          # Preload（TS）
│   ├── shared/                           # 前后端共享类型（TS）
│   └── runtime/                          # .NET 后端工程
│       ├── WishfulClaw.sln
│       ├── WishfulClaw.Core/              # Agent 核心框架
│       │   ├── AgentLoop/                 # 循环主体
│       │   ├── Providers/                 # 模型 Provider（5种）
│       │   ├── Tools/                     # 工具框架（基类/注册/执行）
│       │   ├── Protocol/                  # 通信协议（MessagePack）
│       │   └── Context/                   # 上下文管理/压缩
│       ├── WishfulClaw.Workspace/         # 业务层（记忆 + 人格）
│       │   ├── Memory/                    # 记忆系统（读写/检索/分层/巩固）
│       │   ├── Persona/                   # 人格系统（Identity/Soul/PromptBuilder）
│       │   └── Files/                     # 工作区文件管理
│       ├── WishfulClaw.Worker/            # 进程入口（被 Electron 拉起）
│       │   ├── Modules/                   # 模块注册
│       │   └── Program.cs
│       └── WishfulClaw.Contracts/         # 接口契约（Core 和 Workspace 共享）
├── docs/
├── scripts/
└── README.md
```

## 分层说明

| 层 | 职责 | 参考 |
|----|------|------|
| **Core** | Agent 通用框架，不包含业务逻辑 | KodaClaw SDK（Kode.Agent.Sdk） |
| **Workspace** | 记忆 + 人格，业务逻辑 | KodaClaw Runtime / Workspace |
| **Worker** | 进程入口，组装 Core + Workspace | KodaClaw Gateway |
| **Contracts** | 接口契约，Core 和 Workspace 解耦 | KodaClaw Contracts |
