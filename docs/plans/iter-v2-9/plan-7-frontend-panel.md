# Plan 7: 前端 Goal 进度面板

## 目标

实现前端 Goal 进度面板：计划列表 + 每个计划的步骤状态 + 实时日志 + 429 等待状态 + 暂停/恢复/中止按钮。用户可实时看到 Goal 执行进度，了解当前在做什么、做到哪了、是否在等额度恢复。

## 步骤清单

- [ ] 步骤1：Goal Store — `goal-store.ts`：管理 Goal 状态（当前 Goal 元信息 + 计划列表 + 每个计划状态 + 实时日志 + 429 退避状态 + 中断状态）。从 workerRequest 事件流更新状态
- [ ] 步骤2：IPC 事件适配 — `handleEnvelope` 路由 goal_* 事件到 goal-store：goal_started / plan_started / plan_completed / plan_failed / plan_evaluated / plan_retried / backoff_started / backoff_progress / backoff_resolved / goal_paused / goal_resumed / goal_aborted / goal_completed
- [ ] 步骤3：Goal 进度面板组件 — `GoalPanel.tsx`：展示当前 Goal 的计划列表，每个计划显示标题 + 状态图标（待执行/执行中/已完成/失败/重试中）+ 步骤进度 + 结果摘要
- [ ] 步骤4：计划展开详情 — 点击计划可展开查看步骤列表（从 state.json 读取）+ 子 Agent 执行日志摘要
- [ ] 步骤5：429 等待状态展示 — 当 Goal 处于 429 退避时，面板顶部显示等待状态卡片："额度限制，等待恢复中... 已等待 X 分钟，下次尝试 +Ymin"，带旋转/脉冲动画
- [ ] 步骤6：中断按钮 — 面板底部 [暂停] [中止] 按钮，暂停变为 [恢复]。调用 goal:interrupt / goal:resume / goal:abort IPC
- [ ] 步骤7：Goal 创建入口 — 聊天输入框增加 "Goal 模式" 开关（类似 Plan 模式的 banner），开启后发送的消息作为 Goal 目标
- [ ] 步骤8：右侧面板集成 — Goal 进度面板作为右侧面板的一个 tab（与 Plan Review、SubAgents 等并列），或作为独立面板覆盖
- [ ] 步骤9：实时日志流 — 底部滚动日志区，显示编排循环的关键事件时间线（拆分计划 / 子 Agent 启动 / 评估结果 / 429 退避 / 计划完成）
- [ ] 步骤10：编译验证 — 三个 tsc 配置全部零错误

## 验证检查点

- 开启 Goal 模式 → 发送目标 → 面板出现计划列表
- 计划状态实时更新（待执行 → 执行中 → 已完成/失败）
- 429 退避时显示等待状态卡片
- 暂停/恢复/中止按钮正常工作
- 日志流实时更新
- 切换会话时 Goal 面板内容跟随切换（session 级隔离）

## 涉及文件

- `src/renderer/src/stores/goal-store.ts` — 新建
- `src/renderer/src/components/goal/GoalPanel.tsx` — 新建
- `src/renderer/src/components/goal/GoalPlanCard.tsx` — 新建（单个计划卡片）
- `src/renderer/src/components/goal/GoalBackoffBanner.tsx` — 新建（429 等待状态卡片）
- `src/renderer/src/components/goal/GoalLogStream.tsx` — 新建（实时日志流）
- `src/renderer/src/lib/ipc/handleEnvelope.ts` — 修改（路由 goal_* 事件）
- `src/renderer/src/components/chat/` — 修改（Goal 模式入口开关）
- `src/renderer/src/components/right-panel/` — 修改（集成 Goal 面板 tab）

## 参考源码

- 现有 PlanReviewCard + plan-store — 直接参考 UI 模式和状态管理
- 现有 SubAgentsPanel — 参考 sub_agent 事件处理和面板布局
- 现有 plan mode banner — 参考 session 级隔离模式（planModesBySession）
