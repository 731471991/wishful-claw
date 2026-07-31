"""Patch AGENTS.md: update project overview and reference source section."""
import pathlib

p = pathlib.Path(r"D:\claw\wishful-claw\AGENTS.md")
text = p.read_text(encoding="utf-8")

# 1. Update project overview
old_overview = """## 项目概述

Wishful Claw 是一个 Agent 编程软件，融合 OpenCowork 的 Agent Loop + 工具链、KodaClaw 的记忆与人格设计、OpenClaw.net 的记忆主动回忆机制。代码已从三个参考项目迁移并适配为 WishfulClaw 自有命名空间，参考项目仅作为历史溯源。"""

new_overview = """## 项目概述

Wishful Claw 是一个 Agent 编程软件，参考四个开源项目：

- **OpenCowork** —— Agent Loop、工具链、Provider、流式协议。搬运了大量代码并适配为 WishfulClaw 自有命名空间。
- **KodaClaw** —— 记忆系统、人格系统、PromptBuilder。借鉴设计思路，代码自行实现。
- **OpenClaw.net** —— 记忆主动回忆、记忆工具、上下文预算。借鉴设计思路，代码自行实现。
- **DeepSeek-Reasonix** —— 缓存命中率统计、工具注册发现。借鉴设计思路，代码自行实现。

其中 OpenCowork 搬运了大量代码，其余三个项目主要借鉴设计思路和架构理念，代码由 WishfulClaw 自行实现。"""

assert old_overview in text, "old overview not found"
text = text.replace(old_overview, new_overview, 1)

# 2. Update reference source section header and description
old_ref = """## 参考源码（历史溯源）

> 以下项目代码已迁移并适配为 WishfulClaw 命名空间。参考项目仅作为历史溯源，开发时不再直接参考，除非需要理解原始设计意图。"""

new_ref = """## 参考源码

> 以下是 WishfulClaw 的设计思路来源。OpenCowork 搬运了大量代码并适配为自有命名空间，其余项目主要借鉴设计思路，代码由 WishfulClaw 自行实现。"""

assert old_ref in text, "old ref header not found"
text = text.replace(old_ref, new_ref, 1)

# 3. Update table rows
old_table = """| OpenCowork | `D:\\claw\\OpenCowork` | Agent Loop、工具链、Provider、流式协议（已迁移） |
| KodaClaw | `D:\\claw\\koda-claw` | 记忆系统、人格系统、PromptBuilder（已迁移） |
| OpenClaw.net | `D:\\claw\\openclaw.net` | 记忆主动回忆、记忆工具、上下文预算（已迁移） |
| DeepSeek-Reasonix | `D:\\claw\\DeepSeek-Reasonix` | 缓存命中率统计、工具注册发现（参考中） |"""

new_table = """| OpenCowork | `D:\\claw\\OpenCowork` | Agent Loop、工具链、Provider、流式协议（搬运代码） |
| KodaClaw | `D:\\claw\\koda-claw` | 记忆系统、人格系统、PromptBuilder（借鉴思路） |
| OpenClaw.net | `D:\\claw\\openclaw.net` | 记忆主动回忆、记忆工具、上下文预算（借鉴思路） |
| DeepSeek-Reasonix | `D:\\claw\\DeepSeek-Reasonix` | 缓存命中率统计、工具注册发现（借鉴思路） |"""

assert old_table in text, "old table not found"
text = text.replace(old_table, new_table, 1)

p.write_text(text, encoding="utf-8")
print("Done")
