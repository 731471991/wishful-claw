# v2-iter-18 规划：体验收口（小改进批量）

> 来源：知识库 issues/改进.md 未完成项
> 分支：dev/v2-iter-18

## 范围（3 项）

### 1. 429 限流重试次数配置化
- 现状：`ProviderRetryPolicy.MaxRetryAttempts = 10` 硬编码
- 改动：
  - 设置 store 新增 `requestMaxRetries`（默认 10；0 = 无限重试）
  - `buildProviderPayload` 下发 `requestMaxRetries`
  - C# `ProviderRetryPolicy.ExecuteAsync` 增加 provider JsonElement 参数，读取 `requestMaxRetries`；null/缺省 → 10；0 → 无限；>0 → 指定次数
  - 超过 10 次的重试间隔固定 60s（服务商限流场景），前 10 次维持指数退避
  - 无限模式下事件 `MaxAttempts` 发 0，前端 retry 状态显示 attempt 无上限
  - GeneralPanel 增加"请求重试次数"输入（与请求超时同区），迁移逻辑补默认值

### 2. 输入框状态恢复独立显示（思考中/接收中）
- 现状：`thinking_encrypted`（DeepSeek 类加密思考）不产生 thinking 内容块，整个思考期显示"等待响应"；与"接收中"混淆
- 改动（composer-status-indicator.tsx + runtime-status.tsx 两份逻辑同步）：
  - live selector 暴露 `thinkingEncrypted`
  - 思考判定：`hasActiveThinking || thinkingEncrypted` 且无文本输出 → "思考中"
  - 无任何输出且当前模型启用思考配置 → 也显示"思考中"（首 token 前即推理期）
  - 其余无输出场景维持"等待响应"

### 3. 工具调用权限"默认"模式确认范围
- 现状：主循环 `checkRequiresApproval` 无人调用，默认模式实际无确认
- 改动：
  - C# `ToolCallProcessor`：读 `parameters.permissionMode == "default"` 时，写/删/执行类工具（Write/Edit/Bash/Shell/ShellExec/PowerShell/Monitor/DesktopClick/DesktopType/DesktopScroll）走审批
  - 审批复用 sub-agent 反向请求链路（同一 `sub-agent:approve-tool` method），拒绝时返回 rejected 工具结果
  - renderer `sub-agent-approval.ts` 泛化：主会话审批弹 confirm 对话框（显示工具名 + 输入摘要），批准/拒绝；批准可选"本次会话不再询问该工具"（写入 approvedToolNames）
  - fullAccess / whitelist 模式不受影响

## 验证
- `npx tsc --noEmit -p tsconfig.web.json` 零报错
- `dotnet build`（Worker）零错误
- 人工验证项：重试次数生效、状态独立显示、默认模式 Bash/Write 弹确认

## 不做（留后续迭代）
- Goal 编排可视化（iter-19）
- 消息滚动锚点吸附 + 虚拟列表闪烁（iter-20）
