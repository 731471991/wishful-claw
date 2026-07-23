# Plan 6-5: SplashPage 改造 — 首次启动人格选择

> 前置：Plan 6-3（全局人格管理 UI）、Plan 6-4（项目级人格管理 UI）已完成。

## 目标

改造启动流程：首次启动 → 选择全局人格 → 进入主页；之后每次启动直接跳主页。参考 OpenCowork 的 OnboardingPage 流程。

## 步骤

### ✅ 步骤 1: settings-store 加 defaultPersonaId
- 新增 `defaultPersonaId: string` 字段
- 默认值 `''`（空字符串）
- persist 自动持久化

### ✅ 步骤 2: PersonaSelectPage.tsx
- 新建 `src/renderer/src/components/splash/PersonaSelectPage.tsx`
- 调用 persona/list 获取人格列表
- 卡片式展示（名称/tagline/描述/内置标签）
- 选中后高亮，点击"开始使用"保存
- 保存：updateSettings({ defaultPersonaId, onboardingCompleted: true, onboardingCompletedAt })
- 保存后 enterMain()

### ✅ 步骤 3: SplashPage 改造
- 检查 onboardingCompleted
  - true → useEffect 中直接 enterMain()
  - false → 渲染 PersonaSelectPage
- 保留设置入口（AI 服务商设置）

### ✅ 步骤 4: i18n 更新
- layout.json 加 splash.personaSelect 相关翻译

### 验证
- electron-vite build 通过
- 首次启动看到人格选择，选完后进入主页
- 再次启动直接进主页
