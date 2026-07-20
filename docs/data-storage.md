# Wishful Claw 数据存储设计

## 设计原则

- 记忆/人格：纯文件（Markdown），人可读、可编辑、Git 友好
- 会话/消息 + 搜索索引 + 项目注册：单个 SQLite，全局唯一
- 项目级数据：纯文件，放在项目工作区目录下

## 存储结构

### 全局目录

```
~/.wishful-claw/
├── SOUL.md                         # 全局人格
├── IDENTITY.md                     # 全局身份
├── USER.md                         # 全局用户画像
├── MEMORY.md                       # 全局活跃记忆
├── memory/
│   ├── topics/                     # 主题记忆
│   ├── dormant/                    # 休眠记忆
│   └── archive/                    # 归档记忆
└── index.db                        # SQLite（全局唯一）
```

### 项目工作区

项目本身注册在 SQLite 中，记录项目名和工作区路径。项目级文件放在工作区路径下的 `.wishful-claw/`：

```
{项目工作区路径}/
├── 用户的项目代码...
└── .wishful-claw/
    ├── SOUL.md                     # 项目人格（覆盖全局）
    ├── MEMORY.md                   # 项目记忆
    ├── memory/
    │   ├── topics/
    │   ├── dormant/
    │   └── archive/
    └── tasks/                      # 任务管理（全文件驱动）
        ├── active/                 # 进行中的任务
        ├── done/                   # 已完成
        └── archive/                # 已归档
```

任务以 Markdown 文件形式存储，记录任务描述、状态、进度、执行记录。助手通过读写这些文件来发布任务和跟踪进度。

## SQLite 用途

全局唯一的 `index.db` 负责三件事：

| 表 | 用途 |
|----|------|
| 项目注册表 | 项目名、工作区路径、项目配置等 |
| 会话/消息历史 | 对话记录、工具调用记录，高频读写，按项目关联 |
| FTS 搜索索引 | 记忆全文搜索索引，记忆文件变更时同步更新 |

记忆内容本身不在 SQLite 里，都在 Markdown 文件中。删掉 index.db 不丢记忆，索引可重建。

## 数据关系

```
SQLite（index.db）
├── 项目注册表 ──→ 记录项目名 + 工作区路径
│       │
│       └──→ {工作区路径}/.wishful-claw/  ← 项目级记忆/人格文件
│
├── 会话/消息表 ← 按项目关联，实时写入
│
└── FTS 索引表  ← 同步自记忆文件（全局 + 项目级）

记忆文件（Markdown，source of truth）
  全局: ~/.wishful-claw/MEMORY.md + memory/*
  项目: {工作区路径}/.wishful-claw/MEMORY.md + memory/*
         │
         └── 同步 ──→ FTS 索引表（可重建）
```

## 数据流向

### 记忆读取

```
用户发消息
  ↓
Agent Loop 开始前
  ↓
TryInjectRecall(userMessage)
  ↓
查询 FTS 索引（全局 + 当前项目）
  ↓
命中 → 读取对应 Markdown 文件内容 → 注入对话上下文
```

### 记忆写入

```
Agent 判断需要记忆
  ↓
通过 memory_write 工具写入 Markdown 文件
  ↓
同步更新 FTS 索引
```

### 记忆巩固

```
定时触发 / Agent 主动触发
  ↓
读取 memory/sessions/ → 评估 → 写入 memory/topics/ 或降级到 dormant/
  ↓
同步更新 FTS 索引
```
