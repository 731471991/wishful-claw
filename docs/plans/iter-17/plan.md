# Plan: v2-iter-17 — 缺陷修复迭代

## 目标

修复 Obsidian 知识库 issues 中登记的 6 个未处理缺陷/交互问题（2026-08-19 核对 + 用户实测反馈）+ 迭代中新增的日志分级需求（#7）。
不含：虚拟列表 prepend 闪烁（方案未定，留待后续）、快速搜索 utools 式匹配增强 / Goal 编排可视化 / 工具权限范围（改进类，排后续迭代）。

## 前置状态

- 分支从最新 main（v0.2.16）拆出
- 工作区带有 iter-15/16 之后的文件拆分未提交改动（settings-store / ui-store / DbMessageTools / ipc handlers 等），三层 TS 编译已验证通过，随本迭代首个功能单元一起提交

## 修复清单

### 1. 🔴 左侧面板收起报 React error #300（已修复）

- **根因**：`src/renderer/src/components/layout/WorkspaceSidebar.tsx` 中 `if (!leftSidebarOpen) return null` 早退发生在 `useState(searchOpen)` 之前，收起/展开切换导致 hooks 调用数量不一致
- **修复**：将 `const [searchOpen, setSearchOpen] = useState(false)` 移到组件顶部（所有早退 return 之前）
- **验证**：点击顶部收起/展开图标反复切换不报错，搜索弹窗正常

### 2. 🟡 快速搜索（启动器）焦点未自动定位（偶发，已修复）

- **现状**：08-18 已加 `launcher:reset` 事件 + 显示后 50ms focus（`src/main/quick-launcher.ts` / `src/renderer/src/launcher/main.tsx`），问题为**偶发性**焦点丢失
- **排查方向**：50ms 固定延时不可靠（窗口未加载完/系统繁忙时失效）；改为事件驱动 + 重试：窗口 `shown`/`focus` 事件触发 focus，renderer 侧用轮询/`requestAnimationFrame` 重试直到 `document.activeElement` 是输入框；blur 隐藏后再 show 的路径单独验证
- **验证**：Alt+Space 连续唤起 10+ 次，光标稳定落在搜索框

### 3. 🟡 剪贴板增强 复制内容未到目标（已修复，实测通过）

- **链路**：`clipboard:copy`（`src/main/clipboard-enhancer.ts`）→ `clipboard.writeText` → `pasteToForegroundWindow`（`src/main/priority-shortcuts.ts` Windows bridge 模拟粘贴）
- **根因**：bridge `Paste()` 中 `SetForegroundWindow` 失败是静默的，仅固定 Sleep(80ms) 后就注入 Ctrl+V —— 激活失败时按键落到当时恰在前台的窗口（或丢失），内容无法到达目标
- **修复**：
  - `Activate()` 轮询等待激活真正生效（最多 ~500ms），替代固定 Sleep
  - 失败后用 Alt 键 foreground-lock workaround 重试一次
  - 注入 Ctrl+V 前强制校验 `GetForegroundWindow() == target`，不满足绝不注入
  - 失败路径输出 stderr → 走 bridge stderr → logWarn，日志可查
- **追加（多输入框焦点跑偏，参考 Ditto `ExternalWindowTracker` 源码移植）**：
  - 热键按下时用 `GetGUIThreadInfo` 额外捕获前台窗口内的**焦点控件 HWND**，随 `pressed` 消息上报并持久化到粘贴时
  - 粘贴前 `AllKeysUp`：释放热键残留的 Ctrl/Shift/Alt（避免注入的 Ctrl+V 被叠加成 Ctrl+Shift+V，浏览器中等于“粘贴纯文本”导致异常行为）
  - 激活期间临时置零 `SPI_SETFOREGROUNDLOCKTIMEOUT`，激活后恢复
  - 激活成功后 `RestoreFocus`：attach 目标线程 + `SetFocus(记录的焦点控件)`，把键盘焦点强制还原到唤起前所在的输入框（Ditto 同款）
  - 稳定等待从 60ms 提到 120ms，给目标应用内部焦点恢复留时间
  - 局限：浏览器内 hwndFocus 是单个 render widget，页面内哪个 input 聚焦无法从 Win32 层区分，依赖 Chrome 自身 caret 恢复 + 干净修饰键状态
- **追加（第三轮：Chrome 焦点落到工具栏按钮）**：
  - 用户对照实验确认：Ditto 唤起同样会抢焦点，隐藏时能还原网页输入框焦点；我们的面板隐藏后 Chrome 焦点落在工具栏按钮
  - 嫌疑定位：Alt fallback（Chrome 收到单独 Alt 击键会把焦点移到菜单按钮）+ 面板隐藏后重复激活干扰 Chrome 内部焦点恢复
  - 修复：激活逻辑抽为 `EnsureForeground` —— 目标已在前台直接跳过激活；否则先给 300ms 宽限期等系统自然归还前台；仍失败才走 SPI 置零 + Activate，Alt fallback 降为最后手段并输出 stderr 日志
  - 新增 `ActivateOnly`（只还原前台不注入按键）：面板被快捷键 toggle/Esc 主动隐藏时调用 `pasteToForegroundWindow(target, focus, false)` 显式把焦点还给原窗口（Ditto 同款行为）；blur 被动隐藏不抢焦点（焦点已在用户点击的窗口）
- **追加（第四轮：焦点监视器实证，另见 Ditto 源码分析文档 `D:\claw\Ditto\Ditto-master\docs`）**：
  - 监视器（20ms 轮询前台窗口 + `GetGUIThreadInfo.hwndFocus`）实证：隐藏面板后 Chrome 回前台，但焦点控件只落在 **Chrome 顶层窗口（67278）**，从未到达 `Chrome_RenderWidgetHostHWND` —— 网页 DOM 焦点因此丢失
  - 根因一：`RestoreFocus` 拿到的 hwndFocus 是顶层 frame，SetFocus 顶层窗口不会触发 Chrome 把 DOM 焦点还给输入框
  - 根因二：我们是先 hide 再激活，OS 自动窗口切换与激活竞态（t=54.904 前台已切 Chrome 但焦点还在面板窗口）；Ditto 是 `ReleaseFocus()` 先于 `ShowWindow(SW_HIDE)`
  - 修复：
    - `RestoreFocus` 当捕获的焦点是顶层/无效时，`EnumChildWindows` 查找类名 `Chrome_RenderWidgetHostHWND` 并 SetFocus 给它（Chrome 收到渲染控件焦点会还原 DOM 输入框焦点）
    - 隐藏时序反转：先 `ActivateOnly`（激活目标 + 焦点还原）再 `hide()`；`clipboard:copy` 也同步调整为 writeText → hide → paste
- **追加（第五轮：真正根因 —— Alt 系快捷键，用户改用 Ctrl+` 后验证正常）**：
  - 用户配置的是 `Alt+V`。低级键盘钩子只能在完整组合命中时拦截最后一个键，**Alt 按下本身会先漏给 Chrome** → Chrome 收到单独 Alt 击键把焦点移到右上角菜单按钮（唤起瞬间即可观察到）；后续隐藏/粘贴时 Chrome 内部处于菜单态，DOM 焦点无法还原
  - Ditto 用系统级 `RegisterHotKey`，整个含修饰键的序列被系统直接拦下，不会漏给应用；我们的钩子方案无法阻止修饰键本身
  - 修复（Alt 兼容层，换回 Alt+V 也可用）：
    - 热键命中时立即合成释放按下的修饰键（`ReleasedMods` 记录），真实修饰键抬起时吞掉，避免应用看到二次 Alt down/up 再次触发菜单态
    - 还原/粘贴链路新增 `clearMenu` 参数（快捷键含 Alt 时为 true）：激活目标 + RestoreFocus 后注入一次 Esc，清除 Chrome 的菜单按钮焦点、把焦点还给网页
    - clipboard-enhancer 记录唤起快捷键是否含 Alt（`openedWithAlt`），随 copy/hide 链路传递
- **实测结论**：Ctrl+` 等非 Alt 快捷键下网页粘贴/焦点还原全部正常；Alt+V 下粘贴功能正常，唤起瞬间 Chrome 仍有短暂菜单聚焦反应（低级钩子无法阻止 Alt 按下漏给应用，Esc 只能事后清除），用户确认可接受不再处理
- **验证**：浏览器中唤起剪贴板面板 → 双击条目/Enter → 网页收到粘贴内容；连续多次、切换不同目标窗口测试；唤起后直接 toggle 隐藏，网页输入框焦点应还原

### 4. 🟡 扩展功能子项闪烁（已修复）

- **现状**：`WorkspaceSidebar.tsx` 扩展菜单为受控 Radix DropdownMenu（hover 打开 + 150ms 延时关闭），子项已显示仍重复播放入场动画
- **排查方向**：`extensionsOpen` 状态被 hover 事件反复重置导致 Portal 重挂载 / Radix 动画 CSS 每次 open 重触发；考虑禁用重复入场动画或改 hover 状态判定
- **验证**：鼠标移入扩展菜单后子项稳定显示不闪烁

### 5. 🟡 输入框提示词优化点击后永久卡住（已修复）

- **现状**：`use-prompt-optimizer.ts` 有 try/catch/finally，但流式请求无 AbortController/超时；网络挂起时 `isOptimizing` 永久为 true，`isOptimizingLocked` 锁定输入区无法恢复
- **修复**：为优化请求加 AbortController + 超时（如 60s）；取消按钮调用 abort；异常/超时后确保 `isOptimizing=false` 且弹窗可关闭
- **验证**：断网/慢网下点击优化不会永久卡住，取消可恢复输入

### 6. 🟡 剪贴板交互增强：方向键实测不可用 + 缺双击粘贴（已实现）

- **原状**：`handleListKeyDown` 挂在列表容器 div，焦点在搜索输入框，按键事件不冒泡，方向键实际不生效；仅单击触发粘贴，无双击语义
- **实现（Ditto 风格交互模型）**：
  - 单击 = 选中条目，双击 = 粘贴
  - 键盘监听改 window 级：方向键上下切换选中 + Enter 粘贴（焦点在搜索框也生效）
  - 置顶/删除按钮加 `onDoubleClick` stopPropagation，避免双击按钮误触发粘贴
- **验证**：唤起剪贴板后不点鼠标，纯方向键切换选中 + Enter 粘贴；单击选中高亮；双击粘贴到目标应用

### 7. 🟡 日志分级：发布版仅写 error（已实现）

- **背景**：日志无分级过滤，渲染进程 console.warn/error 补丁、chat-store 高频 info、Worker 输出全部落盘，日志膨胀严重
- **实现**（`src/main/lib/logger.ts`，所有来源统一走 `writeLog` 一处过滤）：
  - `LogLevel` 新增 `debug` 级；`writeLog` 按 `MIN_LEVEL` 阈值过滤
  - 打包版（`app.isPackaged`）仅落 `error`；开发版全量（debug 及以上）
  - 支持环境变量 `WISHFUL_CLAW_LOG_LEVEL=error|warn|info|debug` 覆盖，方便打包版临时排障
  - 新增 `logDebug` API；`log:write` IPC 支持 debug 级上报
- **验证**：`npm run dev` 下日志含 warn/info；打包版运行后日志文件仅出现 ERROR 条目

### 8. 🟡 快速搜索匹配增强（知识库改进项纳入，进行中）

- **来源**：知识库 `改进.md` 2026-08-19 待优化项（参考 utools 匹配逻辑）+ 用户追加反馈
- **需求**：
  - ① Windows 内置应用（便签等 UWP/打包应用）也能搜出——当前只扫 Start Menu .lnk，UWP 应用无 .lnk
  - ② 英文简写/模糊匹配：`wc` 匹配 Wishful Claw（词首字母），支持空格分隔与驼峰边界（如 `wc` 匹配 wishfulClaw）
  - ③ 启动历史优先：搜索结果中启动历史条目排前面
  - ④ 历史与注册表去重：同一应用不同名时按真实目标路径去重（.lnk 解析 target）
- **实现**（`src/main/quick-launcher.ts`）：
  - UWP 扫描：PowerShell + `Shell.Application` 枚举 `shell:AppsFolder` 命名空间（`GetDetailsOf($item,2)` 取 AppUserModelId），缓存到 `~/.wishful-claw/uwp-apps.json`（24h TTL，过期后台刷新当轮用旧缓存），path 用 `shell:AppsFolder\<AppUserModelId>` 形式，`shell.openPath` 可直接启动
  - 历史优先：`getOrRefreshAppList` 合并顺序为 历史 → 自定义 → Start Menu .lnk → UWP；搜索评分中历史条目 +1000 分恒定排前；`launcher:launch` 记录历史后失效缓存
  - 匹配：预生成名称变体，搜索时用输入值在变体中任意命中（includes）——原小写名 / 去空格纯小写（wishfulclaw）/ 词首+驼峰首字母小写（wc，Wishful Claw / wishfulClaw / WeChat 均得 wc）/ 拼音全拼与首字母；分层评分 —— 完全相等(100) > 名称前缀(90) > 拼音全拼前缀(88) > 拼音首字母前缀(86) > 子串(80-位置) > 去空格包含(75) > 首字母包含(70) > 拼音包含(60/58)；按分数降序取前 50
  - 去重：.lnk 用 `shell.readShortcutLink().target` 解析真实路径作 key（+名称 key），历史先入池占位，后续同目标/同名条目跳过——历史与注册表一致时只保留历史条目；AppsFolder 中路径型 AppId 直接用 exe 路径入池，与 .lnk 目标去重
  - 渲染侧（`src/renderer/src/launcher/main.tsx`）：历史条目显示"历史"徽标
- **实测修复（第一轮反馈）**：
  - 便签搜不到：实测该机器 AppsFolder 命名空间**第 2 列为空**，AppId 在第 0 列、显示名在第 1 列 → 改用 `GetDetailsOf($item,0/1)`；另旧逻辑 `*!*` 过滤把非经典 AUMID（Chrome.F64CFL.../com.xxx 形式）全部滤掉 → 去除该过滤（仅排除 http* URL 快捷方式）；旧版写入的空缓存 24h 不过期 → 手动删除 `~/.wishful-claw/uwp-apps.json` + 扫描完成后失效 appListCache
  - 焦点被抢：扫描进程未加 `windowsHide: true`，控制台窗口闪现抢焦点；且 spawnSync 阻塞主进程数秒干扰焦点时序 → 改异步 spawn + windowsHide + 30s watchdog
  - gc 排序：首字母/去空格名**全等**命中计 85 分，高于名称中部子串（80-位置）→ Google Chrome 排到杂项命中之前
  - 启动：`shell:AppsFolder\...` 伪路径 `shell.openPath` 不支持 → 改 `spawn('explorer.exe', [path])`
- **借鉴 ZTools（D:\claw\ZTools-main，开源 uTools 类项目）扫描器分析**：
  - 已采纳：`SKIP_NAME_PATTERN` 过滤卸载/帮助/文档类噪音条目；`SKIP_FOLDERS` 递归跳过 sdk/docs/samples 等文件夹；新增桌面快捷方式扫描（用户桌面 + 公共桌面，平铺不递归）
  - **系统设置入口已搬入**（用户要求直接搬）：新建 `src/main/launcher-system-settings.ts`（同质数据单文件），完整移植 ZTools 的 ~90 项 ms-settings URI + 控制面板/管理工具/系统工具；入池时 path 用 `syscmd:<command>` 标记，`launcher:launch` 按类型分发（ms-settings → openExternal / shell: → explorer / 带参命令行 → spawn / .msc → mmc / .cpl → control / 裸 exe → openPath）；渲染侧加"系统"徽标；"清空回收站"因需确认弹窗未搬
  - 不采纳及理由：native C++ 扫描模块（TS+PowerShell 已够用）；Fuse.js（分层评分可预测且已覆盖拼音/首字母，拼写容错作后续候选）；chokidar 监听（5分钟 TTL + 失效机制够用）；`name|targetPath` 组合去重（允许同名异标共存，与用户"同目标去重"需求相反）
- **便签搜不到的最终根因（第二轮）**：PowerShell 管道输出实际是 **GBK**（hex 实证），旧代码按 UTF-16LE 解码全是乱码 → 解析 0 条。修复：先 UTF-8 解码，含替换符则回退 GBK（`TextDecoder('gbk')`）；另空缓存（apps.length===0）也触发重扫，不再等 24h TTL
- **UWP 条目无图标（第三轮）**：`app.getFileIcon` 解析不了 `shell:AppsFolder\...` 伪路径。ZTools 用自编译 native C++ 模块取图标；我们用同等 Windows API 路线的 PowerShell 内联 C# 替代：扫描脚本 `Add-Type` 编译 `ShellIconExtractor`（SHParseDisplayName → IShellItem → IShellItemImageFactory.GetImage），每个非路径型条目提取 48px PNG 存入 `~/.wishful-claw/uwp-icons/`，输出第三列 iconPath 写入缓存（UwpCacheFile 加 version 强制旧缓存重扫）；`AppShortcut.iconFile` 供 `withIcon` 直接读图，历史条目按 path 反查继承；提取失败回退首字母；watchdog 30s→60s
- **图标黑底（第四轮）**：便签图标提取成功但显示为"默认图标"——`Bitmap.FromHbitmap` 会丢弃 GetImage 返回的 32bpp 预乘 HBITMAP 的 alpha 通道，透明区域填黑（像素级对比实证：中心点旧图 (115,105,57) 是黄×黑混合，新图 (236,195,0) 纯黄；四角 alpha 255→0）。修复：C# 内改用 GetObject+GetBitmapBits 手动拷 BGRA 位数据（bottom-up DIB 翻转为 top-down），保留 alpha；全 0 alpha 平面兼容为不透明；`UWP_CACHE_VERSION` 2→3 强制重扫覆盖黑底 PNG
- **验证**：搜 `wc` 出 Wishful Claw；搜"便签"出 Windows 内置应用**且带图标**；搜"设备管理器"/"声音"出系统设置条目带"系统"标；启动过的应用搜任意命中词时排第一且带"历史"标；重复应用不出现两条

## 步骤建议

1. 提交工作区拆分改动（编译已通过，作为首个 commit）
2. 按 1 → 4 → 6 → 5 → 2 → 3 顺序修复（1/4 同文件；6 与 3 同属剪贴板模块；2/3 依赖运行时实测）
3. 每修一项本地验证，全部完成后按功能单元 commit
4. 编译验证：三个 tsconfig 带 `-p` 零错误；如涉及 C# 则 `dotnet build`

## 验证检查点

- [x] 左侧面板收起/展开切换无 React error #300
- [x] Alt+Space 连续唤起 10+ 次焦点稳定落在输入框（偶发问题需压测）
- [x] 剪贴板点击条目后目标应用收到粘贴（含网页输入框，Ctrl+` 实测通过）
- [x] 剪贴板交互：方向键切换选中 + Enter 粘贴 + 单击选中 + 双击粘贴均可用
- [x] 扩展菜单子项不闪烁
- [x] 提示词优化可取消、超时不卡死
- [x] 打包版日志仅 ERROR；开发版全量（可用 `WISHFUL_CLAW_LOG_LEVEL` 覆盖）
- [x] 三层 TS 编译零错误
- [x] #8 快速搜索：`wc` 匹配 Wishful Claw；能搜出便签等内置应用；能搜出设备管理器等系统设置；历史条目排前带"历史"标；重复应用只出一条
