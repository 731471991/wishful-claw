# Plan 9: 协作模式选择器 + Goal 入口重构

## 目标

在输入框最左侧增加协作模式下拉选择器，将 Goal 模式从 SkillsMenu 中提出来作为独立模式，与常规模式并列。Plan 模式保留在常规模式下的 SkillsMenu 中作为功能开关。同时修复 SkillsMenu 中 `useChannelStore` 不存在的属性导致的崩溃。

## 背景

当前 Goal 模式的开关藏在 SkillsMenu 下拉菜单中，用户不容易发现。且 SkillsMenu 中引用了 `channel-store` 中不存在的 `activeChannelIdsByProject` 和 `toggleActiveChannel` 属性，打开菜单时直接报错崩溃。

参考 OpenCowork 的协作模式实现：TitleBar 中使用 `DropdownMenu` 组件，每个选项包含图标 + 标签 + 描述，选中项有勾选标记。

## 步骤清单

- [ ] 步骤1：修复 SkillsMenu 崩溃 — `activeChannelIdsByProject` 和 `toggleActiveChannel` 在 channel-store 中不存在，添加 `?? {}` 和 `?? (() => {})` 兜底
- [ ] 步骤2：UI Store 添加协作模式状态 — 在 `useUIStore` 中增加 `collabModesBySession: Record<string, 'normal' | 'goal'>`，默认 `undefined` 即为常规模式
- [ ] 步骤3：创建协作模式选择器组件 — `CollabModeSwitcher.tsx`，放在 `composer-toolbar` 最左侧，ModelSwitcher 前面
  - 使用 `DropdownMenu` 组件
  - 两个选项：常规（💬 图标 + 标签 + 描述）、目标（🎯 图标 + 标签 + 描述）
  - 选中项显示勾选标记
  - 样式参考 ModelSwitcher / OpenCowork TitleBar
- [ ] 步骤4：集成到 ComposerToolbar — 将 `CollabModeSwitcher` 放在 ModelSwitcher 左侧
  - 传入当前模式状态和切换回调
  - `disabled` 条件同 Goal 模式（流式/优化中禁用）
- [ ] 步骤5：InputArea 模式联动逻辑
  - 切到目标模式 → placeholder 变为"描述要追求的目标..."，发送消息时作为目标
  - 切回常规模式 → 如果有 Goal 在执行，暂停/清除
  - GoalSessionBar 仅在目标模式下显示（不再依赖 DB 查询结果）
  - 目标模式下 SkillsMenu 隐藏 Plan 模式开关
- [ ] 步骤6：SkillsMenu 中移除 Goal 模式开关 — 因为 Goal 模式已提到协作模式选择器
  - 保留 Plan 模式开关（常规模式下可用）
- [ ] 步骤7：i18n 文案 — 协作模式下拉选项的中英文标签和描述
- [ ] 步骤8：编译验证 — `npx tsc --noEmit -p tsconfig.web.json` 零错误

## 验证检查点

- 输入框左侧显示协作模式下拉，默认选中"常规"
- 点开下拉，显示"常规"和"目标"两个选项，有图标和描述
- 选中"目标"模式，输入框 placeholder 变为"描述要追求的目标..."
- 选中"目标"模式，发送消息时作为目标发送
- 切回"常规"模式，如果 Goal 在执行则暂停，GoalSessionBar 隐藏
- 常规模式下 SkillsMenu 中能正常开启/关闭 Plan 模式
- 目标模式下 SkillsMenu 中不显示 Plan 模式开关
- SkillsMenu 点开不再崩溃
- 切换会话时模式状态跟随 session 隔离

## 涉及文件

- `src/renderer/src/components/chat/SkillsMenu.tsx` — 修复 channel store 崩溃 + 移除 Goal 模式开关
- `src/renderer/src/components/chat/CollabModeSwitcher.tsx` — 新建，协作模式选择器
- `src/renderer/src/components/chat/InputArea/composer-toolbar.tsx` — 集成 CollabModeSwitcher
- `src/renderer/src/components/chat/InputArea/index.tsx` — 模式联动逻辑
- `src/renderer/src/stores/ui-store.ts` — 新增 `collabModesBySession` 状态
- 相关 i18n 翻译文件

## 参考源码

- OpenCowork TitleBar.tsx — 协作模式下拉的实现方式（DropdownMenu 组件，选项含图标+标签+描述+勾选标记）
- 现有 ModelSwitcher — 风格参考（位置布局、尺寸）
- 现有 plan-store / goal-store — 模式状态管理参考（session 级隔离模式）