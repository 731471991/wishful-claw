import pathlib

p = pathlib.Path('docs/iteration-plan.md')
content = p.read_text(encoding='utf-8')

old = """### v2-iter-7：主聊天接入工作台模式

**目标**：Agent 在指定工作区目录下执行任务，工具调用绑定到该目录。

| 步骤 | 内容 |
|------|------|
| 1 | 工作台模式定义 — Agent 在指定工作区目录下执行任务，工具调用绑定到该目录 |
| 2 | 主聊天界面模式选择/切换 UI |
| 3 | 与项目注册关联 — 选择项目即绑定工作区路径 |
| 4 | Agent 系统提示词注入工作区信息 |
| 5 | 工具执行时工作区路径绑定（文件读写/Shell 执行限定在工作区内） |

**验证标准**：选择工作台模式 → Agent 在指定工作区目录下执行任务，工具调用绑定到该目录。

**分支**：`dev/v2-iter-7`　**Tag**：`v2.7.0`"""

new = """### v2-iter-7：主聊天接入工作台模式

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

if old in content:
    content = content.replace(old, new, 1)
    p.write_text(content, encoding='utf-8')
    print('OK: replacement done')
else:
    old_crlf = old.replace('\n', '\r\n')
    if old_crlf in content:
        content = content.replace(old_crlf, new.replace('\n', '\r\n'), 1)
        p.write_text(content, encoding='utf-8')
        print('OK: replacement done (CRLF)')
    else:
        print('FAIL: text not found')
        # Debug: find the line
        for i, line in enumerate(content.split('\n')):
            if 'v2-iter-7' in line:
                print(f'Line {i}: {repr(line)}')
