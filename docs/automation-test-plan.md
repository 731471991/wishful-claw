# wishful-claw 自动化测试方案

## 1. 背景与目标

wishful-claw 当前零测试覆盖——没有测试框架、没有测试文件、没有 CI 集成。随着工具链快速迁移（已移植 17 个 ToolProvider + 视频模块 + Extension 运行时），回归风险持续积累。

**核心问题**：如何高效建立自动化测试能力？

**独特优势**：项目已内建桌面控制工具链（Screenshot / Click / Type / Scroll / Wait），Agent 可以像人一样操作 UI。这开启了一条"软件自己测试自己"的路径。

## 2. 两条路径对比

### 路径 A：Agent 驱动的自测（Agent-Driven Self-Testing）

**原理**：在应用内创建一个"测试 Agent"，通过桌面控制工具操作自身 UI。测试用例用自然语言描述，Agent 截图识别界面 → 点击按钮 → 输入文本 → 截图验证结果。

**工作流**：

```
测试用例（Markdown）
  ↓
测试 Agent 读取用例
  ↓
DesktopScreenshot → 多模态 LLM 识别界面
  ↓
DesktopClick / DesktopType 操作 UI
  ↓
DesktopScreenshot → LLM 判断结果是否正确
  ↓
输出测试报告
```

**已有的基础设施**：

| 组件 | 状态 | 说明 |
|------|------|------|
| 桌面控制工具（5 个） | ✅ 已完成 | Screenshot/Click/Type/Scroll/Wait，通过 reverse-request 到 Main Process |
| SubAgent 机制 | ✅ 已完成 | 从 `~/.wishful-claw/agents/*.md` 加载子 Agent，支持独立 system prompt |
| ToolDispatchRouter | ✅ 已完成 | 自动路由 Desktop 工具到 AgentRuntimeDesktopExecutor |
| 多模态模型支持 | ✅ 已完成 | modelSupportsVision + 图片 base64 传入 |

**需要新增的组件**：

| 组件 | 工作量 | 说明 |
|------|--------|------|
| 测试 Agent 定义文件 | 小 | `~/.wishful-claw/agents/test-runner.md`，定义测试 Agent 的 system prompt |
| 测试用例格式规范 | 小 | Markdown + YAML frontmatter（复用 SubAgent 的 frontmatter 解析） |
| 测试结果断言工具 | 中 | 新增 `AssertVisible` / `AssertText` 等工具，让 Agent 做结构化断言而非纯靠 LLM 判断 |
| 测试调度入口 | 中 | IPC `test/run-suite` → 读取用例 → 逐条调用 Agent → 汇总报告 |
| 测试报告生成 | 小 | Markdown / JSON 格式 |

**示例测试用例**：

```markdown
---
name: provider-switch
description: 验证用户可以切换 AI 提供商
---

1. 截图确认应用主界面已加载
2. 点击顶栏的模型选择器
3. 截图确认下拉列表显示至少 2 个模型
4. 点击列表中第二个模型
5. 截图确认顶栏显示的模型名称已变更
6. 断言：当前选中模型 = 第二个模型名称
```

**优点**：
- **零代码编写测试**——用自然语言描述即可，降低编写门槛
- **覆盖完整用户流程**——从 UI 到 Worker 到数据库的全链路
- **复用现有基础设施**——桌面控制 + SubAgent + 多模态，几乎不需要新代码
- **探索性测试能力强**——Agent 可以发现预期外的 UI 状态

**局限**：
- **速度慢**——每步截图 + LLM 推理约 2-5 秒，一个用例可能 30-60 秒
- **断言不精确**——依赖多模态模型理解截图，可能误判（"按钮看起来是灰色的"vs 实际 disabled 属性）
- **不适合 CI/CD**——需要完整启动应用 + LLM API 调用，成本高
- **坐标依赖**——Click 需要绝对坐标，不同分辨率/DPI 下可能偏移
- **无法测试非可视化逻辑**——Worker 内部逻辑、数据库操作、IPC 协议等

---

### 路径 B：Playwright + Electron 测试框架

**原理**：用 Playwright 的 Electron 支持，直接控制应用窗口。通过 `page.locator()` 精确选择 DOM 元素，`expect()` 做断言。

**工作流**：

```
test('provider switch', async ({ page }) => {
  await page.locator('[data-testid="model-switcher"]').click()
  await expect(page.locator('[role="listbox"] option')).toHaveCount.greaterThan(1)
  await page.locator('[role="listbox"] option:nth-child(2)').click()
  await expect(page.locator('[data-testid="active-model-name"]')).toHaveText(/.+/)
})
```

**需要新增的组件**：

| 组件 | 工作量 | 说明 |
|------|--------|------|
| Playwright + @playwright/test 安装 | 小 | `npm i -D @playwright/test` |
| Electron 测试配置 | 小 | `playwright.config.ts`，配置 `electronApp.launch()` |
| 测试辅助工具 | 中 | 启动 Worker、初始化数据库、清理状态的 fixtures |
| data-testid 属性标注 | 中 | 关键 UI 组件添加 `data-testid` |
| 首批测试用例 | 中 | 覆盖核心流程：启动、模型切换、消息发送、工具调用 |
| CI 集成 | 小 | GitHub Actions / 本地 `npm test` |

**优点**：
- **断言精确**——直接检查 DOM 属性、文本内容、可见性
- **速度快**——每个用例 1-5 秒，无 LLM 调用
- **CI/CD 友好**——headless 运行，可集成到构建流水线
- **覆盖全面**——可测 UI + 可测 Worker（通过 IPC mock 或真实调用）
- **生态成熟**——Playwright 文档丰富，社区支持好

**局限**：
- **需要写代码**——每个测试用例都是 TypeScript 文件
- **初始搭建成本**——配置 Electron 测试环境、编写 fixtures
- **无法测试系统级交互**——原生弹窗、系统托盘等 Playwright 够不着的场景
- **维护成本**——UI 变化时需要同步更新测试

---

### 路径 C：混合方案（A + B 互补）

**原理**：Playwright 做精确断言和回归测试，Agent 自测做探索性测试和系统级交互。

**分工**：

| 场景 | 路径 | 原因 |
|------|------|------|
| UI 元素断言（按钮可见、文本正确） | Playwright | 精确、快速 |
| 表单提交 + 数据验证 | Playwright | 可检查数据库 |
| 核心用户流程回归 | Playwright | CI/CD 必须 |
| 系统级交互（原生弹窗、托盘） | Agent 自测 | Playwright 够不着 |
| 探索性测试（随机操作找 bug） | Agent 自测 | Agent 擅长发现边界情况 |
| 多步骤长流程验证 | Agent 自测 | 自然语言描述更高效 |

## 3. 工作量估算

### 路径 A：Agent 自测

| 任务 | 预估时间 | 依赖 |
|------|---------|------|
| 测试 Agent 定义 (test-runner.md) | 0.5h | 无 |
| 测试用例格式设计 + 3 个示例用例 | 1h | 无 |
| 断言工具 (AssertVisible/AssertText) | 2h | ToolProvider + ToolDispatchRouter |
| 测试调度 IPC (test/run-suite) | 2h | AgentRuntimeModule |
| 测试报告生成 | 1h | 无 |
| 端到端验证 + 调试 | 2h | 应用可启动 |
| **合计** | **~8.5h** | |

### 路径 B：Playwright

| 任务 | 预估时间 | 依赖 |
|------|---------|------|
| 安装 @playwright/test + 配置 | 1h | 无 |
| Electron 启动 fixture | 2h | 应用可构建 |
| Worker 启动 + 数据库初始化 fixture | 2h | Worker 可独立启动 |
| data-testid 标注（10 个核心组件） | 1.5h | 无 |
| 首批 5 个测试用例 | 3h | fixtures 完成 |
| CI 脚本 | 0.5h | 测试通过 |
| 端到端验证 + 调试 | 2h | 全部完成 |
| **合计** | **~12h** | |

### 路径 C：混合

路径 A + 路径 B 的并集，但有共享部分（fixtures、data-testid），合计约 **~16h**。

## 4. 技术风险

### 路径 A 风险

| 风险 | 严重度 | 缓解方案 |
|------|--------|---------|
| 多模态模型误判截图 | 高 | 新增结构化断言工具（AssertVisible/AssertText），不完全依赖 LLM 判断 |
| 坐标偏移（DPI/分辨率） | 中 | Screenshot 返回实际尺寸，Agent 按比例计算坐标 |
| LLM API 成本 | 中 | 回归测试用 Playwright，Agent 自测仅用于探索性测试 |
| Agent 陷入死循环 | 中 | MaxTurns 限制 + 超时机制 |

### 路径 B 风险

| 风险 | 严重度 | 缓解方案 |
|------|--------|---------|
| Electron + Playwright 版本兼容 | 中 | Electron 43 + Playwright 最新版，社区已有成功案例 |
| Worker 子进程启动 | 中 | 测试中可 mock Worker IPC 或用真实进程 |
| 测试环境数据库污染 | 低 | 每个测试用例使用临时数据库目录 |
| CI 环境 GUI 依赖 | 中 | 使用 xvfb (Linux) 或 headless 模式 |

## 5. 推荐方案

**推荐路径 C（混合），但分阶段实施**：

### 阶段一（立即）：Playwright 基建 + 核心冒烟测试

先搭 Playwright + Electron 测试框架，写 5 个核心冒烟测试：
1. 应用能正常启动
2. 模型选择器能打开和切换
3. 消息能发送和收到回复
4. 设置页面能打开
5. 渠道配置页面能打开

这能给项目提供最基本的回归保护。

### 阶段二（后续）：Agent 自测模式

在 Playwright 基建稳定后，增加 Agent 自测模式：
1. 创建 test-runner SubAgent
2. 实现断言工具（AssertVisible/AssertText）
3. 设计测试用例格式
4. 用于探索性测试和复杂流程验证

### 理由

- Playwright 是测试的"骨架"——精确、快速、CI 友好，是任何严肃项目的测试基线
- Agent 自测是"补充"——擅长 Playwright 不擅长的场景（系统级交互、探索性测试）
- 先 Playwright 能立即提供回归保护，Agent 自测可以渐进式添加
- 两者共享 data-testid 等基础设施，投入不重复

## 6. 目录结构设计

```
tests/
├── e2e/                          # Playwright 测试
│   ├── fixtures/
│   │   ├── app.ts                # Electron 启动 fixture
│   │   ├── worker.ts             # Worker 进程 fixture
│   │   └── database.ts           # 临时数据库 fixture
│   ├── smoke.spec.ts             # 冒烟测试
│   ├── chat.spec.ts              # 聊天功能测试
│   ├── model-switcher.spec.ts    # 模型切换测试
│   └── settings.spec.ts          # 设置页面测试
├── agent/                        # Agent 自测
│   ├── agents/
│   │   └── test-runner.md        # 测试 Agent 定义
│   ├── cases/
│   │   ├── provider-switch.md    # 测试用例
│   │   ├── send-message.md
│   │   └── channel-config.md
│   └── reports/                  # 测试报告输出
├── playwright.config.ts          # Playwright 配置
└── README.md                     # 测试指南
```
