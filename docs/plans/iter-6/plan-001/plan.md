# Plan 6-1: 后端人格数据层

## 目标

搭建人格系统的后端数据模型和文件读写层：PersonaModels（数据模型）+ PersonaStore（读写 .md 文件，全局+项目双库路径解析）+ 内置 6 套 .md 预设文件编写。

## 步骤清单

- [ ] 步骤1：数据模型 — PersonaModels.cs
  - 新建 `src/runtime/WishfulClaw.Worker/Persona/PersonaModels.cs`
  - 定义：PersonaSummary（id, name, tagline, description, isBuiltin）
  - 定义：PersonaConfig（id, name, tagline, description, isBuiltin, identityMd, soulMd, ontologyMd, agentsMd）
  - 定义：PersonaFileLayout 常量（目录名、文件名）
  - 验证：`dotnet build` 通过

- [ ] 步骤2：文件读写层 — PersonaStore.cs
  - 新建 `src/runtime/WishfulClaw.Worker/Persona/PersonaStore.cs`
  - 实现路径解析：全局库 `~/.wishful-claw/personas/{id}/`，项目库 `{workingFolder}/.wishful-claw/personas/{id}/`
  - 实现：ListPersonas（扫描目录，返回 PersonaSummary 列表）
  - 实现：GetPersona（读 4 个 .md 文件，返回 PersonaConfig）
  - 实现：SavePersona（写 4 个 .md 文件，创建目录）
  - 实现：DeletePersona（删除目录，内置预设不可删）
  - 实现：CopyToProject（从源库复制人格到项目库）
  - 验证：`dotnet build` 通过

- [ ] 步骤3：内置 6 套预设 .md 文件
  - 新建 `src/runtime/WishfulClaw.Worker/Resources/Personas/` 目录
  - 编写 6 套人格，每套 4 个 .md 文件：
    - default/（小爪）
    - lao-zheng/（老郑，从 D:\work\2026-04\lao-zheng 适配）
    - jarvis/（贾维斯）
    - taozi/（桃子）
    - tingjie/（婷姐）
    - aming/（阿明）
  - 在 .csproj 中配置嵌入资源
  - 验证：`dotnet build` 通过，资源编译无报错

## 涉及文件

### 新建
- `src/runtime/WishfulClaw.Worker/Persona/PersonaModels.cs`
- `src/runtime/WishfulClaw.Worker/Persona/PersonaStore.cs`
- `src/runtime/WishfulClaw.Worker/Resources/Personas/default/IDENTITY.md`
- `src/runtime/WishfulClaw.Worker/Resources/Personas/default/SOUL.md`
- `src/runtime/WishfulClaw.Worker/Resources/Personas/default/ONTOLOGY.md`
- `src/runtime/WishfulClaw.Worker/Resources/Personas/default/AGENTS.md`
- `src/runtime/WishfulClaw.Worker/Resources/Personas/lao-zheng/` （4 个 .md）
- `src/runtime/WishfulClaw.Worker/Resources/Personas/jarvis/` （4 个 .md）
- `src/runtime/WishfulClaw.Worker/Resources/Personas/taozi/` （4 个 .md）
- `src/runtime/WishfulClaw.Worker/Resources/Personas/tingjie/` （4 个 .md）
- `src/runtime/WishfulClaw.Worker/Resources/Personas/aming/` （4 个 .md）

### 修改
- `src/runtime/WishfulClaw.Worker/WishfulClaw.Worker.csproj` — 配置嵌入资源

## 参考源码
- KodaClaw `KodaClawWorkspaceLayout.cs` — 文件布局常量
- KodaClaw `WorkspaceReadinessService.cs` — 文件存在性检查
- `D:\work\2026-04\lao-zheng` — 老郑人格文件来源
