# Plan: v2-iter-17 — 缺陷修复迭代

## 目标

修复 Obsidian 知识库 issues 中登记的 6 个未处理缺陷/交互问题（2026-08-19 核对 + 用户实测反馈）。
不含：虚拟列表 prepend 闪烁（方案未定，留待后续）、快速搜索 utools 式匹配增强 / Goal 编排可视化 / 工具权限范围（改进类，排后续迭代）。

## 前置状态

- 分支从最新 main（v0.2.16）拆出
- 工作区带有 iter-15/16 之后的文件拆分未提交改动（settings-store / ui-store / DbMessageTools / ipc handlers 等），三层 TS 编译已验证通过，随本迭代首个功能单元一起提交

## 修复清单

### 1. 🔴 左侧面板收起报 React error #300（根因已定位）

- **根因**：`src/renderer/src/components/layout/WorkspaceSidebar.tsx` 中 `if (!leftSidebarOpen) return null` 早退发生在 `useState(searchOpen)` 之前，收起/展开切换导致 hooks 调用数量不一致
- **修复**：将 `const [searchOpen, setSearchOpen] = useState(false)` 移到组件顶部（所有早退 return 之前）
- **验证**：点击顶部收起/展开图标反复切换不报错，搜索弹窗正常

### 2. 🟡 快速搜索（启动器）焦点未自动定位（偶发）

- **现状**：08-18 已加 `launcher:reset` 事件 + 显示后 50ms focus（`src/main/quick-launcher.ts` / `src/renderer/src/launcher/main.tsx`），问题为**偶发性**焦点丢失
- **排查方向**：50ms 固定延时不可靠（窗口未加载完/系统繁忙时失效）；改为事件驱动 + 重试：窗口 `shown`/`focus` 事件触发 focus，renderer 侧用轮询/`requestAnimationFrame` 重试直到 `document.activeElement` 是输入框；blur 隐藏后再 show 的路径单独验证
- **验证**：Alt+Space 连续唤起 10+ 次，光标稳定落在搜索框

### 3. 🟡 剪贴板增强 复制内容未到目标

- **链路**：`clipboard:copy`（`src/main/clipboard-enhancer.ts`）→ `clipboard.writeText` → `pasteToForegroundWindow`（`src/main/priority-shortcuts.ts` Windows bridge 模拟粘贴）
- **排查方向**：`previousForegroundWindow` 捕获时机（唤起面板瞬间的前台窗口句柄是否有效）、bridge `paste` 消息是否执行成功、hide 后焦点归还时序
- **验证**：浏览器中唤起剪贴板面板 → 点击条目 → 网页收到粘贴内容

### 4. 🟡 扩展功能子项闪烁

- **现状**：`WorkspaceSidebar.tsx` 扩展菜单为受控 Radix DropdownMenu（hover 打开 + 150ms 延时关闭），子项已显示仍重复播放入场动画
- **排查方向**：`extensionsOpen` 状态被 hover 事件反复重置导致 Portal 重挂载 / Radix 动画 CSS 每次 open 重触发；考虑禁用重复入场动画或改 hover 状态判定
- **验证**：鼠标移入扩展菜单后子项稳定显示不闪烁

### 5. 🟡 输入框提示词优化点击后永久卡住

- **现状**：`use-prompt-optimizer.ts` 有 try/catch/finally，但流式请求无 AbortController/超时；网络挂起时 `isOptimizing` 永久为 true，`isOptimizingLocked` 锁定输入区无法恢复
- **修复**：为优化请求加 AbortController + 超时（如 60s）；取消按钮调用 abort；异常/超时后确保 `isOptimizing=false` 且弹窗可关闭
- **验证**：断网/慢网下点击优化不会永久卡住，取消可恢复输入

### 6. 🟡 剪贴板方向键选中实测有问题（已实现但不可用）

- **现状**：`src/renderer/src/clipboard/main.tsx` 已实现 `handleListKeyDown`（方向键上下 + Enter 粘贴），但用户实测有问题
- **疑似根因**：`onKeyDown` 挂在列表容器 div 上，而焦点在搜索输入框（自动 focus）——输入框不是列表容器的子元素，按键事件不会冒泡到列表 div，方向键实际不生效；另需检查 selectedIndex 与置顶排序后列表的同步
- **修复方向**：键盘监听改为 window 级（或挂在根容器/搜索框 onKeyDown 上）；确认选中项高亮、scrollIntoView、Enter 粘贴在搜索态/非搜索态都可用
- **验证**：唤起剪贴板后不点鼠标，纯方向键上下切换选中 + Enter 粘贴成功

## 步骤建议

1. 提交工作区拆分改动（编译已通过，作为首个 commit）
2. 按 1 → 4 → 6 → 5 → 2 → 3 顺序修复（1/4 同文件；6 与 3 同属剪贴板模块；2/3 依赖运行时实测）
3. 每修一项本地验证，全部完成后按功能单元 commit
4. 编译验证：三个 tsconfig 带 `-p` 零错误；如涉及 C# 则 `dotnet build`

## 验证检查点

- [ ] 左侧面板收起/展开切换无 React error #300
- [ ] Alt+Space 连续唤起 10+ 次焦点稳定落在输入框（偶发问题需压测）
- [ ] 剪贴板点击条目后目标应用收到粘贴
- [ ] 剪贴板纯键盘操作：方向键切换选中 + Enter 粘贴可用
- [ ] 扩展菜单子项不闪烁
- [ ] 提示词优化可取消、超时不卡死
- [ ] 三层 TS 编译零错误
