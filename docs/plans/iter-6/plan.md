# 迭代六：人格系统

> 原计划迭代六为记忆系统、迭代七为人格系统。经讨论决定人格系统先做（阻塞初始页面 SplashPage），记忆系统推迟到下一个迭代。

## 背景与动机

初始页面（SplashPage）一直没处理，主要原因是需要等待人格选择功能。做完人格系统后可以串联初始流程：首次启动 → 选择人格 → 进入主页；之后每次启动检查已选人格直接跳主页。

## 参考源码

| 项目 | 路径 | 参考内容 |
|------|------|---------|
| KodaClaw | `D:\gy\koda-claw\koda-claw` | 人格注入机制（PromptBuilder + ContextDocuments）、人格文件结构（IDENTITY/SOUL/ONTOLOGY/AGENTS）、字符预算截断、BootstrapDraftService（AI 生成人格草稿）、WorkspaceReadiness（检测人格是否已设置） |
| OpenCowork | `D:\gy\OpenCowork` | 人格管理 UI 模式（SoulsPage 列表/预览/安装/编辑）、builtin-souls 内置模板、souls-store 状态管理、onboarding 人格选择流程 |
| 老郑人格实例 | `D:\work\2026-04\lao-zheng` | 完整的人格文件示例（IDENTITY/SOUL/ONTOLOGY/AGENTS/EXAMPLES），作为内置预设"老郑"的来源 |

## 三个参考项目的关键设计对比

| 维度 | KodaClaw | OpenCowork | wishful-claw 取法 |
|---|---|---|---|
| 人格文件结构 | IDENTITY + SOUL + ONTOLOGY + AGENTS + USER，5 个 Markdown | 单个 SOUL.md | **KodaClaw 多文件**，表达力强，完整 Markdown 原文注入 |
| 人格库 | 无独立人格库，预设只用于初始化写入 workspace | 内置 6 模板 + 在线市场 | **内置预设库**，先不做在线市场 |
| 安装/切换 | apply-persona 写文件到 workspace | souls:install 写文件到 global/project | **写入文件 = 安装到人格库** |
| 人格可编辑 | Agent 可通过工具更新 .md 文件 | 用户手动编辑 | **人格库文件用户可手动编辑 + AI 辅助创建** |
| 会话级切换 | 不支持，全局一套 | 不支持，全局或项目级 | **会话级绑定 personaId** |
| 注入方式 | ContextDocuments（完整 Markdown 原文作为上下文文档） | 拼入 systemPrompt 字符串 | **KodaClaw 的 ContextDocuments** |
| 字符预算 | 有截断机制（WithCharacterBudget） | 无 | **取 KodaClaw 的** |
| 全局 vs 项目 | 全局一套 | 全局 + 项目两个目标 | **全局人格库 + 项目人格库，结构统一** |
| AI 创建人格 | BootstrapDraftService：对话 → 生成 IDENTITY/SOUL/USER 草稿 | 无 | **用户给提示词 → Agent 生成 4 个 .md 草稿 → 用户确认保存** |

## 核心设计原则

1. **人格不是配置参数，是上下文文档** — 模型读完整的人格 Markdown 原文，语感自然出来，不是 `tone: "direct"` 这种丢信息的字段
2. **人格在输出时体现，不介入 Agent Loop 决策** — 人格段（IDENTITY + SOUL + ONTOLOGY）影响输出风格，行为准则段（AGENTS）影响 Agent Loop 决策
3. **会话级绑定** — 每个 session 绑定一个 personaId，发消息时后端按 session 的 personaId 读取对应人格文件
4. **全局 + 项目双人格库，统一结构** — 全局人格库和项目人格库结构完全一致，一套 IPC 端点，通过 workingFolder 参数区分作用域
5. **人格可编辑** — 人格库中所有 .md 文件用户可手动编辑，也支持 AI 辅助创建

## 人格文件结构

每个人格由 4 个 Markdown 文件组成（参考 KodaClaw，去掉 USER.md 和 EXAMPLES.md，USER.md 属于记忆系统，EXAMPLES.md 后续可加）：

```
personas/{personaId}/
├── IDENTITY.md      # 身份信息：姓名、背景、角色定位、外在印象、内在特质
├── SOUL.md           # 灵魂：核心性格、沟通风格、互动模式、底线、原则
├── ONTOLOGY.md       # 认知/价值观：本质定义、能力边界、价值观优先级、诚实性原则
└── AGENTS.md         # 行为准则：记忆写入边界、工具使用原则、安全策略、错误处理
```

### 两层分离

- **人格层**（IDENTITY + SOUL + ONTOLOGY）→ 影响输出风格，是"说话像谁"
- **行为准则层**（AGENTS）→ 影响 Agent Loop 决策，是"做事的方式"

## 存储结构

### 全局人格库

```
~/.wishful-claw/personas/
├── default/          IDENTITY.md  SOUL.md  ONTOLOGY.md  AGENTS.md
├── lao-zheng/        IDENTITY.md  SOUL.md  ONTOLOGY.md  AGENTS.md
├── jarvis/           IDENTITY.md  SOUL.md  ONTOLOGY.md  AGENTS.md
├── minimalist/       IDENTITY.md  SOUL.md  ONTOLOGY.md  AGENTS.md
├── analyst/          IDENTITY.md  SOUL.md  ONTOLOGY.md  AGENTS.md
├── mentor/           IDENTITY.md  SOUL.md  ONTOLOGY.md  AGENTS.md
└── {custom-id}/      ...（用户创建的自定义人格）
```

全局人格库用户可编辑：手动修改 .md 文件、AI 辅助创建新人格、删除自定义人格（内置预设不可删）。

### 项目人格库

```
{projectFolder}/.wishful-claw/personas/
├── default/          IDENTITY.md  SOUL.md  ONTOLOGY.md  AGENTS.md
├── lao-zheng/        ...
└── {custom-id}/      ...
```

项目人格库是独立实例，与全局库互不影响。创建项目时把内置预设复制进去，之后项目内可以独立增删改、AI 创建人格。

### 统一操作

人格管理操作（list / get / save / delete / generate）通过 `workingFolder` 参数区分作用域：
- 传 `workingFolder` → 操作项目人格库 `{workingFolder}/.wishful-claw/personas/`
- 不传 `workingFolder` → 操作全局人格库 `~/.wishful-claw/personas/`

## 内置预设人格（6 套）

每套包含完整的 4 个 .md 文件，打包在后端 Resources/Personas/ 目录中（编译时复制），只读。

### 设计原则：没有十全十美的人，有些小缺陷才是美

人格不全是正向的。每个预设都有明确的性格亮点和对应的"小缺陷"——不是 bug，是特色。这些缺陷让人格像真人，而不是完美助手模板。注入给模型后，模型会自然带出这些特质。

| ID | 名称 | 性格亮点 | "小缺陷"（有底线，不影响专业能力） | 来源 |
|---|---|---|---|---|
| `default` | 小爪 | 默认助手，均衡友好，适配各种场景 | 太"正确"，偶尔显得没个性，关键时刻不给强烈主张 | 从当前 system-prompt.ts 的风格迁移 |
| `lao-zheng` | 老郑 | 技术搭档兄弟，直接果断、逻辑清晰 | 排版洁癖（看到不对齐忍不住说）；吵架记逻辑漏洞下次翻出来；给虚安慰会烦；偶尔粗口 | 搬 `D:\work\2026-04\lao-zheng` 的文件（适配命名） |
| `jarvis` | 贾维斯 | 英式管家，优雅周到、主动汇报 | 过度礼仪式（说句"好"够了，他非要"非常乐意"）；简单事也走流程确认；文雅表达偶尔让人愣 | 新写 |
| `taozi` | 桃子 | 俏皮小女生，活泼话多，气氛担当 | 跑题，正经问题也会扯到"诶这个我好像见过！"；过度热情，只要答案她叭叭说一堆；偶尔颜文字语气词，严肃场景不太镇得住。但技术判断不马虎 | 新写 |
| `tingjie` | 婷姐 | 严肃利落，大姐大风范，要求高 | 做得不好直接说"这个不行，重做"；不太会安慰人，给的是"问题在这，改完就好"；有点强势习惯替你做决定。但尊重你的最终选择 | 新写 |
| `aming` | 阿明 | 耐心温和，喜欢讲原理，确认你懂了再推进 | 话多，只要答案他从头讲起；老反问"你觉得呢"，急的时候抓狂；不许走捷径。但真的急他会收敛 | 新写 |

这些"缺陷"在 SOUL.md 和 ONTOLOGY.md 中写成性格的一部分，不是负面标签，而是"他就是这样的人"。用户如果不喜欢可以换人格、编辑 .md、或 AI 创建一个新的。

## 人格获取方式（三条路径，不互斥）

### 1. 选内置预设

浏览人格库 → 选中 → 直接用于会话。快速上手。

### 2. AI 辅助创建

用户输入提示词（如"我要一个像老郑那样但更幽默的技术搭档"）→ 后端调用模型生成 4 个 .md 草稿 → 前端展示预览，用户可编辑 → 确认保存到人格库。

数据流：
```
前端：用户输入提示词 + 可选参考人格 ID
  → IPC: persona/generate
  → 后端 PersonaGenerator：
    → 用 Bootstrap profile 的 PromptBuilder 构建生成指令
    → 调模型 API（单轮，非 Agent Loop）
    → 模型返回 JSON: { identity, soul, ontology, agents }
  → 前端：展示 4 个 Markdown 预览，用户可编辑
  → 用户确认 → IPC: persona/save → 写入 personas/{id}/
```

参考 KodaClaw BootstrapDraftService 的模式，简化为用户给提示词一次性生成，不走对话流程。

### 3. 手动编辑

直接编辑人格库中任意 .md 文件。精细调整。选了预设后也能再手动改，AI 创建后也能手动改。

## PromptBuilder 分段组装（后端核心）

参考 KodaClaw 的 PromptBuilder 设计，将 System Prompt 构建从前端迁移到后端。

### 分段结构

```
System Prompt =
  [Base Instruction]       ← "You are WishfulClaw..." + Profile 信息
  [Session Context]        ← 时间、运行环境（OS/Shell）
  [Context Documents]      ← 人格 .md 文件作为上下文文档注入（核心）
    全局会话：读 ~/.wishful-claw/personas/{personaId}/ 下 4 个 .md
    项目会话：读 {workingFolder}/.wishful-claw/personas/{personaId}/ 下 4 个 .md
  [Tool Capability]        ← 工具列表 + 使用规则
  [Project Context]        ← Working folder / Project name / Language
  [User Rules]             ← 用户自定义规则
```

### 关键机制

- **ContextDocuments 模式**：人格 .md 文件以完整 Markdown 原文注入，不拆解为字段。每个文件作为独立的 `PromptContextDocument(path, content)` 注入，带文件名标头。
- **字符预算截断**：`WithCharacterBudget(int?)` 设定总字符预算，超限时按文件顺序截断后面的文档，记录哪些被截断。
- **Profile 区分**：`PromptProfile.Main`（正常对话）/ `PromptProfile.Bootstrap`（AI 生成人格时用）。

### 注入时机

参考 KodaClaw：**会话创建时注入一次**，不是每轮对话都重建。AgentLoop 执行前调用 PromptBuilder 组装 System Prompt，之后会话内复用。

### 数据流变更

- **之前**：前端 `buildSystemPrompt()` → 完整字符串 → `provider.systemPrompt` → 后端直接塞入 API
- **之后**：前端传 `personaId` + `workingFolder` + `language` + `userRules` → 后端 `PromptBuilder` 组装完整 System Prompt → 写入 provider 对象供 Provider 使用

## 后端文件结构

```
src/runtime/WishfulClaw.Worker/
├── Persona/
│   ├── PersonaModels.cs          # 数据模型：PersonaSummary / PersonaConfig / PersonaPreset
│   ├── PersonaStore.cs           # 读写人格库 .md 文件（全局 + 项目）；复制人格到项目目录
│   ├── PersonaPresetService.cs   # 加载内置预设（从 Resources/Personas/ 嵌入资源）
│   ├── PromptBuilder.cs          # 分段组装 System Prompt（参考 KodaClaw PromptBuilder）
│   ├── PromptProfile.cs          # Profile 定义：Main / Bootstrap
│   ├── PromptContextDocument.cs  # 上下文文档模型（path + content）
│   ├── PersonaGenerator.cs       # AI 辅助创建：用户提示词 → 调模型 → 返回 4 个 .md 草稿
│   └── PersonaModule.cs          # IPC 端点注册
├── Resources/
│   └── Personas/                 # 内置 6 套预设的 .md 文件（编译时复制为嵌入资源）
│       ├── default/
│       ├── lao-zheng/
│       ├── jarvis/
│       ├── minimalist/
│       ├── analyst/
│       └── mentor/
```

> 注：按 AGENTS.md 分层约定，人格系统应在 WishfulClaw.Workspace 层。但当前项目 Workspace 层还是空的（Class1.cs），迭代一到五的业务逻辑都放在 Worker 层。为保持一致性，人格系统也放 Worker 层，后续如需抽离再迁移。

## IPC 端点设计

| 端点 | 参数 | 返回 | 说明 |
|---|---|---|---|
| `persona/list` | `workingFolder?` | `PersonaSummary[]` | 人格库列表（内置 + 自定义），传 workingFolder 走项目库 |
| `persona/get` | `id, workingFolder?` | `PersonaConfig`（4个.md内容） | 获取完整人格 |
| `persona/save` | `PersonaConfig, workingFolder?` | `{ success, id }` | 保存（新建或更新） |
| `persona/delete` | `id, workingFolder?` | `{ success }` | 仅自定义可删，内置预设不可删 |
| `persona/generate` | `{ prompt, referencePersonaId?, workingFolder? }` | `PersonaConfig` 草稿 | AI 辅助创建，返回未保存的草稿 |
| `persona/apply-to-project` | `{ personaId, projectFolder }` | `{ success }` | 复制单个或全部预设人格到项目人格库 |

## 前端文件结构

```
src/renderer/src/
├── stores/
│   └── persona-store.ts          # 人格状态管理：列表、加载/保存/生成/删除
├── lib/
│   └── persona/
│       └── persona-types.ts      # 类型定义（与后端对齐）
├── components/
│   ├── splash/
│   │   └── PersonaSelectPage.tsx # 首次启动人格选择页（内置预设列表 + AI 创建入口）
│   ├── settings/
│   │   └── PersonaPanel.tsx      # 设置页面人格管理：列表/预览.md/编辑/删除/AI创建
│   ├── chat/
│   │   └── PersonaSwitcher.tsx   # 聊天界面快速切换会话人格
│   └── persona/
│       └── PersonaGenerator.tsx  # AI 辅助创建对话框：输入提示→预览→确认保存
```

## DB 变更

sessions 表加 `PersonaId` 字段（TEXT，nullable）：
- 创建会话时写入用户选择的人格 ID
- 全局会话：personaId 指向全局人格库中的 ID
- 项目会话：personaId 指向项目人格库中的 ID
- 默认值：用户设置的 defaultPersonaId（存在 settings-store 中）

settings-store 新增字段：
- `defaultPersonaId: string` — 新建会话的默认人格
- `onboardingCompleted: boolean` — 是否完成初始人格选择
- `onboardingCompletedAt: number | null`

## 初始流程串联（SplashPage 改造）

```
App 启动
  → 检查 onboardingCompleted（settings-store）
  → 未完成：显示 PersonaSelectPage
    → 内置预设列表（卡片展示，含名称/描述/风格预览）
    → "AI 创建人格"入口
    → 选定 → 保存为 defaultPersonaId → onboardingCompleted = true → enterMain
  → 已完成：直接 enterMain
    → 新建会话时默认用 defaultPersonaId，可在聊天中切换
```

## agent/run 参数变更

前端发送 `agent/run` 时，`provider.systemPrompt` 字段不再使用，改为传：
```jsonc
{
  "provider": { ... },  // 不再包含 systemPrompt
  "personaId": "lao-zheng",
  "workingFolder": "D:\\project",  // 可选，全局会话不传
  "language": "zh-CN",
  "userRules": "",
  "messages": [...],
  "tools": [...]
}
```

后端 `AgentLoop.ExecuteLoopAsync` 在执行前：
1. 根据 workingFolder 确定人格库路径
2. 读取 `personas/{personaId}/` 下 4 个 .md 文件
3. 调用 PromptBuilder 组装完整 System Prompt
4. 写入 provider 对象供 OpenAIChatProvider / AnthropicMessagesProvider 使用

## 验证标准

1. **基本功能**：切换"老郑"和"极简执行者"两种人格，同一个问题得到风格明显不同的回答
2. **AI 创建**：输入"我要一个幽默的技术搭档" → 生成 4 个 .md → 预览 → 确认保存 → 新建会话使用该人格
3. **项目人格库**：创建项目 → 项目人格库初始化 → 项目内会话使用项目人格 → 编辑项目内人格 .md → 下次会话生效
4. **首次启动**：清空 onboarding 状态 → 启动 → 看到人格选择页 → 选择 → 进入主页
5. **编译通过**：tsc + electron-vite build + dotnet build 全部通过

## Plan 拆分

| Plan | 内容 | 独立验证 |
|---|---|---|
| **6-1** | 后端人格核心 — PersonaModels + PersonaStore（读写 .md 文件，全局+项目双库）+ PersonaPresetService（内置 6 套 .md 嵌入资源）+ PromptBuilder + PromptProfile + PromptContextDocument + PersonaModule（IPC 端点：list/get/save/delete/apply-to-project） | `dotnet build` 通过 |
| **6-2** | AgentLoop 集成 + 前端适配 — AgentLoop 调 PromptBuilder 组装 prompt；前端 use-chat-actions 改为传 personaId；persona-store + persona-types；DB 变更（sessions 加 PersonaId）；settings-store 新增字段 | tsc + build + dotnet 全部通过 |
| **6-3** | AI 辅助创建 — PersonaGenerator（后端：提示词→调模型→生成 4 个 .md 草稿）+ persona/generate 端点 + 前端 PersonaGenerator 对话框（输入提示→预览→确认保存） | 生成人格 → 确认保存 → 切换使用 |
| **6-4** | 前端 UI — SplashPage 改造（PersonaSelectPage）+ 设置页 PersonaPanel（列表/预览/编辑/删除）+ 聊天 PersonaSwitcher（会话级切换） | 端到端验证全部通过 |

## 迭代顺序说明

原计划迭代六是记忆系统，迭代七是人格系统。经讨论决定人格系统先做（阻塞初始页面），记忆系统推迟到下一个迭代。聊天底部统计功能也推迟到后面迭代。

迭代计划文档 `docs/iteration-plan.md` 中迭代六/七的顺序后续同步更新。
