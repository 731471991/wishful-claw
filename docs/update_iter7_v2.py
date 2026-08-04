import pathlib

p = pathlib.Path('docs/iteration-plan.md')
content = p.read_text(encoding='utf-8')

old = """### v2-iter-7：主聊天接入工作台模式

**目标**：借鉴灵犀的工作台模式——聊天窗内工具执行过程折叠为摘要块，完整预览移至右侧面板"工作台" tab，实现聊天流清爽 + 执行详情分离。

| 步骤 | 内容 |
|------|------|
| 1 | 新建折叠摘要组件 — Agent 执行工具/命令后，聊天消息内不再内联渲染 ToolCallCard 详情，而是显示折叠块（"运行了XX个命令，查看了X个文件，编辑了X个文件"），下方接 Agent 回复正文 |
| 2 | ToolCallCard 迁移至右侧工作台 — 完整的工具调用预览（命令输出、文件 diff 等）从聊天流移到 RightPanel 新增的"工作台" tab |
| 3 | 工作台会话级隔离 — 切换会话时工作台内容跟随切换，按 sessionId 存储 |
| 4 | 折叠触发时机 — 执行了命令/工具即折叠，或 Agent Loop 超过 2 轮后折叠 |
| 5 | 保留现有执行后操作按钮（debug 等） |

**验证标准**：发送消息 → Agent 执行工具 → 聊天窗显示折叠摘要 + Agent 回复（不内联预览）→ 右侧工作台 tab 展示完整工具调用详情 → 切换会话工作台内容跟随隔离。

**分支**：`dev/v2-iter-7`　**Tag**：`v2.7.0`"""

new = """### v2-iter-7：主聊天接入工作台模式

**目标**：借鉴灵犀的工作台模式——聊天窗统一用折叠块组件渲染 Agent 回复，工具调用预览移至右侧面板"工作台" tab，实现聊天流清爽 + 执行详情分离。

**核心设计**：所有 Agent 回复都走同一个折叠块组件，通过动态值 `collapsible` 区分行为——执行过程中动态计算，一旦有工具调用或 Agent Loop 超过 2 轮即变为 `true`。

| 步骤 | 内容 |
|------|------|
| 1 | 新建折叠块组件 — 统一渲染所有 Agent 回复，通过 `collapsible` 动态值控制行为：`false`（一问一答 ≤2 轮无工具）默认展开不可折叠；`true`（有工具调用或 >2 轮）执行中展开、结束后自动折叠成摘要（"运行了X个命令，查看了X个文件，编辑了X个文件"），点击可展开看精简列表（ToolCallCard 去掉预览部分，保留工具名/参数摘要/状态），完整预览只去右侧工作台 |
| 2 | ToolCallCard 预览迁移至右侧工作台 — 完整的工具调用预览（命令输出、文件 diff、搜索结果等）从聊天流移到 RightPanel 新增的"工作台" tab，执行中实时更新 |
| 3 | 工作台会话级隔离 — 切换会话时工作台内容跟随切换，按 sessionId 存储，排序按当前时间线 |
| 4 | 用户交互保留在折叠块 — 选项选择、输入回复等需要用户操作的交互留在折叠块内，不迁移到工作台 |
| 5 | 保留现有执行后操作按钮（debug 等） |

**验证标准**：纯聊天 → 折叠块展开不可折叠（一问一答）；发送消息触发工具 → `collapsible` 变为 `true`，执行中展开实时更新，结束后自动折叠成摘要 → 右侧工作台展示完整预览 → 切换会话工作台跟随隔离 → 点击摘要可展开看精简列表。

**分支**：`dev/v2-iter-7`　**Tag**：`v2.7.0`"""

if old in content:
    content = content.replace(old, new, 1)
    p.write_text(content, encoding='utf-8')
    print('OK: v2-iter-7 updated')
else:
    old_crlf = old.replace('\n', '\r\n')
    if old_crlf in content:
        content = content.replace(old_crlf, new.replace('\n', '\r\n'), 1)
        p.write_text(content, encoding='utf-8')
        print('OK: v2-iter-7 updated (CRLF)')
    else:
        print('FAIL: text not found')
