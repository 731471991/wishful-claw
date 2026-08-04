import pathlib

p = pathlib.Path('docs/iteration-plan.md')
content = p.read_text(encoding='utf-8')

old = """=== MVP v2（进行中）===
v2-iter-1（Runtime 分层架构重构）✅
  ↓
v2-iter-2（缓存命中率修复）✅
  ↓
v2-iter-3（Infrastructure 层拆分）  ← 当前最高优先级，Worker 瘦身基础设施下沉
  ↓
v2-iter-4（Skill 本地文件安装测试）  ┐
v2-iter-5（渠道配置测试与完善）      ├─ 三者可并行，互不依赖
v2-iter-6（SSH 远程执行测试与完善）  ┘
  ↓
v2-iter-7（主聊天接入工作台模式）  ← 依赖渠道配置验证通过
  ↓
v2-iter-8（Global 全局模式接入）  ← 依赖工作台模式（模式切换 UI 复用）
  ↓
v2-iter-9（Goal 模式接入）  ← 依赖工作台模式（Agent 需绑定工作区自主操作）
```

v2-iter-1、v2-iter-2 已完成。
v2-iter-3（Infrastructure 层拆分）是当前最高优先级——Worker 瘦身后才能进一步拆分工具模块。
v2-iter-4/5/6 可并行执行（测试类任务，互不依赖）。
v2-iter-8 和 v2-iter-9 依赖 v2-iter-7 的模式切换 UI。"""

new = """=== MVP v2（进行中）===
v2-iter-1（Runtime 分层架构重构）✅
  ↓
v2-iter-2（缓存命中率修复）✅
  ↓
v2-iter-3（Infrastructure 层拆分）✅
  ↓
v2-iter-4（Skill 本地文件安装测试）  ┐
v2-iter-5（渠道配置测试与完善）      ├─ 三者可并行，互不依赖，均已完成 ✅
v2-iter-6（SSH 远程执行测试与完善）  ┘
  ↓
v2-iter-7（主聊天接入工作台模式）  ← 当前最高优先级，无前置依赖
  ↓
v2-iter-8（Global 全局模式接入）  ← 依赖工作台 UI（右侧面板 + 折叠交互复用）
  ↓
v2-iter-9（Goal 模式接入）  ← 依赖工作台 UI（Agent 自主操作的展示框架）
```

v2-iter-1 ~ v2-iter-6 已全部完成（tag v2.6.0）。
v2-iter-7（主聊天接入工作台模式）是当前最高优先级——聊天 UI 重构 + 工具调用预览迁移到右侧工作台。
v2-iter-8 和 v2-iter-9 依赖 v2-iter-7 的工作台 UI 框架。"""

if old in content:
    content = content.replace(old, new, 1)
    p.write_text(content, encoding='utf-8')
    print('OK: dependency section updated')
else:
    old_crlf = old.replace('\n', '\r\n')
    if old_crlf in content:
        content = content.replace(old_crlf, new.replace('\n', '\r\n'), 1)
        p.write_text(content, encoding='utf-8')
        print('OK: dependency section updated (CRLF)')
    else:
        print('FAIL: text not found')
