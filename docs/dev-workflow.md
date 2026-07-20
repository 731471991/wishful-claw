# 开发工作流（SOP）

> 纯工作流文档，定义 AI 执行任务的六阶段流程。
> 各阶段的具体规范标准请查阅对应的规范文档。

---

## 工作流总览

```
探索态 → 规划态 → 规划验证 → 执行态 → 审查态 → 验证态
```

---

### 阶段一：探索态（只读探测）

摸清环境现状。主 agent 委托 subagent 只读探测，禁止修改任何文件。

**任务**：
- 探测项目当前结构、已有代码、依赖状态
- 阅读相关参考项目源码（路径见 AGENTS.md）
- 确认当前迭代目标（见 docs/iteration-plan.md）

**输出**：`docs/plans/plan_XXX/exploration_findings.md`

**内容要求**：
- 当前项目状态概述
- 参考源码的关键文件和位置
- 潜在风险和依赖

---

### 阶段二：规划态（写计划）

想清楚再动手。

**步骤**：
1. 创建 `docs/plans/plan_XXX/`
2. 读取相关规范文档（AGENTS.md / docs/data-storage.md / docs/mvp-scope.md / docs/iteration-plan.md）
3. 写 `plan.md`，包含：
   - 任务目标
   - 步骤清单（每步带验证检查点）
   - 涉及的文件和模块
   - 参考源码的具体文件路径
4. 启动规划验证 → 用户确认后才能执行

**plan.md 格式**：

```markdown
# Plan: XXX

## 目标
一句话描述本计划要完成什么。

## 步骤清单
- [ ] 步骤1：描述 + 验证检查点
- [ ] 步骤2：描述 + 验证检查点
- ...

## 涉及文件
- src/runtime/.../xxx.cs — 新建/修改
- src/renderer/.../xxx.tsx — 新建/修改

## 参考源码
- OpenCowork: D:\gy\OpenCowork\... — 具体参考什么
- KodaClaw: D:\gy\koda-claw\koda-claw\... — 具体参考什么
```

---

### 阶段三：规划验证

启动独立 subagent 检查 plan.md 是否符合规范，输出 `compliance_report.md`。

**检查项**：
- 步骤是否完整覆盖任务目标
- 每步是否有明确的验证检查点
- 文件路径是否符合项目结构（AGENTS.md）
- 分层依赖是否正确（Core 不依赖 Workspace 等）
- 是否参考了正确的源码文件

**输出**：`docs/plans/plan_XXX/compliance_report.md`

**完成后**：更新 `docs/PROGRESS.md`

**阻断规则**：❌ 项 > 0 时禁止进入用户确认环节

---

### 阶段四：执行态（循环执行）

```
fs_read(plan.md) → 找到 [ ] 步骤 → 执行 → Mini 验证 → 标记 [✓] → 重复
```

**执行规则**：
- 每次只执行一个步骤
- 执行完立即做 Mini 验证（能编译？能跑？符合预期？）
- 验证通过标记 [✓]，失败标记 [✗] 并记录原因
- 从 OpenCowork / KodaClaw / OpenClaw.net 搬代码时，必须适配项目命名空间和分层约定
- 新建文件必须符合 AGENTS.md 中的目录结构

**终止检查**：所有步骤均为 [✓] / [✗]，0 个 [ ] 残留 → 结束。

---

### 阶段五：审查态

启动独立 subagent 审查代码是否满足需求和规范，输出 `review_report.md`。

**审查项**：
- 代码是否符合分层约定（Core / Workspace / Worker / Contracts）
- 是否有硬编码路径、密钥等
- 是否正确实现参考源码的逻辑（不是照搬，是适配）
- 错误处理是否充分
- 是否引入了不需要的依赖

**输出**：`docs/plans/plan_XXX/review_report.md`

**阻断规则**：❌ 项 > 0 时禁止进入验证态

---

### 阶段六：验证态

独立验证，避免自欺欺人。能跑必须跑，必须有工具证据。

**验证方式**：
- 编译通过（dotnet build / npm run build）
- 运行通过（启动应用，执行对应迭代的验证标准）
- 产出截图或日志作为证据

**输出**：`docs/plans/plan_XXX/verification_report.md`

**完成后**：更新 `docs/PROGRESS.md`（状态 + VERDICT + Commit ID + 日期）

**最终裁定**：`PASS` / `FAIL` / `PARTIAL`

---

## PROGRESS.md 格式

```markdown
# 开发进度

## 迭代一：项目骨架
- 状态：进行中
- Plan: docs/plans/plan_001/
- VERDICT: —
- Commit: —
- 日期: —

## 迭代二：Agent Loop + Provider
- 状态：未开始
...
```

## 注意事项

- 参考源码路径以 AGENTS.md 中的为准
- 搬代码时注意 .NET 命名空间统一为 WishfulClaw.*
- 前端代码注意去掉 OpenCowork 特有的频道、CodeGraph 等不需要的功能
- 每个 plan 编号递增（plan_001, plan_002, ...）
- 验证报告必须有实际证据，不能只写"应该没问题"
