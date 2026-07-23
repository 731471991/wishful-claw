import pathlib

p = pathlib.Path(r'F:\claw\wishful-claw\docs\PROGRESS.md')
content = p.read_text(encoding='utf-8')

old = """## 迭代七：记忆系统
- 状态：未开始
- Plan: —
- VERDICT: —
- Tag: —
- Commit: —
- 日期: —"""

new = """## 迭代七：记忆系统
- 状态：代码完成（8 个 Plan 全部完成，待运行时端到端验证）
- 分支：dev/iter-7
- Plan: docs/plans/iter-7/plan.md (Plan 1~8)
- VERDICT: PASS (编译验证 tsc + dotnet build 全部通过) / 待运行时验证
- Tag: —（待验证后打 v0.7.0）
- Commit: c8b481b ~ aac4ba0
- 日期: 2026-07-23
- 备注：
  - Plan 1: 接口和模型定义 — MemoryModels (MemoryEntry/MemoryTier/MemoryPriority/MemorySearchResult/MemoryStats/MemoryFrontmatter/MemorySection) + IMemoryStore + IMemorySearch + IMemoryRecall
  - Plan 2: 文件层 — MemoryMarkdownParser (## 分段解析+UpsertSection) + MemoryFrontmatterParser (YAML frontmatter) + MemoryPathResolver (scope→路径) + MemoryStore (MEMORY.md/daily/dormant CRUD)
  - Plan 3: FTS5 索引层 — MemoryArchiveEntity + memory_fts FTS5 虚拟表 + 触发器自动同步 + MemoryFtsService (Search/Index/Archive/SearchCold)
  - Plan 4: 记忆工具 — memory_append/memory_search/memory_read/memory_write 4 个工具 + ToolModule 注册 + ToolTypes 加 ProjectId
  - Plan 5: TryInjectRecall — ContextBudgetPlanner (Token×4+字符双限制) + MemoryRecallService (先项目后全局+冷记忆fallback) + AgentLoop iteration==1 时注入
  - Plan 6: System Prompt 集成 — PromptBuilder.BuildMemoryContext 注入 MEMORY.md Critical 段 (预算 6000 字符)
  - Plan 7: MemoryModule IPC — 9 个端点 (stats/list/search/read/write/append/promote/archive/consolidate)
  - Plan 8: 前端 — memory-helpers.ts (IPC 封装) + MemoryPanel.tsx (统计卡片+搜索+结果) + RightPanel 双 tab + i18n (中英文)
  - 三层架构：Hot (MEMORY.md 文件) / Warm (dormant/*.md 文件) / Cold (SQLite memory_archive 表 + FTS5)
  - scope 字段区分：global (~/.wishful-claw/) 或 project:{workingFolder} ({工作区}/.wishful-claw/)
  - TryInjectRecall 注入为 User Message，标注 untrusted reference data 防 prompt injection
  - 迭代六已合并到 main，dev/iter-7 已 rebase 到最新 main"""

# Handle CRLF
old_crlf = old.replace('\n', '\r\n')
new_crlf = new.replace('\n', '\r\n')

if old in content:
    content = content.replace(old, new)
    print("Replaced with LF")
elif old_crlf in content:
    content = content.replace(old_crlf, new_crlf)
    print("Replaced with CRLF")
else:
    print("ERROR: old text not found!")
    exit(1)

p.write_text(content, encoding='utf-8')
print("Done: PROGRESS.md updated")
