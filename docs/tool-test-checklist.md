# 工具测试清单 — Agent 自测用

> 用法：将此文件路径交给 Agent，Agent 逐条调用工具并记录结果。
> 每条测试标记 ✅ 通过 / ❌ 失败（附错误信息）/ ⏭️ 跳过（附原因）。

---

## 测试说明

1. 按顺序逐条执行，每条测试调用对应工具
2. 记录工具返回结果（成功/失败/错误信息）
3. 如果工具不存在于 tool/list 中，标记为 ❌ 并注明"工具未注册"
4. 部分工具有外部依赖（如 API Key、网络），如未配置可标记 ⏭️
5. 测试完成后输出汇总表格

---

## 一、文件操作工具（直接执行）

### 1. Read — 读取文件

- 调用：`Read`，参数 `file_path` 指向一个已知存在的文件（如 `package.json`）
- 预期：返回文件内容

### 2. Write — 写入文件

- 调用：`Write`，参数 `file_path` 指向临时路径，`content` 写入测试文本
- 预期：文件成功创建

### 3. Edit — 精确编辑

- 先用 Write 创建文件内容 `hello world`，再调用 `Edit` 将 `hello` 替换为 `hi`
- 预期：文件内容变为 `hi world`

### 4. LS — 列目录

- 调用：`LS`，参数 `path` 指向项目根目录
- 预期：返回目录下文件列表

### 5. Glob — 文件匹配

- 调用：`Glob`，参数 `pattern` 为 `**/*.json`
- 预期：返回匹配的文件路径列表

### 6. Grep — 全文搜索

- 调用：`Grep`，参数 `pattern` 为 `WishfulClaw`，`path` 为项目根目录
- 预期：返回匹配的行和文件

### 7. Bash — Shell 执行

- 调用：`Bash`，参数 `command` 为 `echo test-ok`
- 预期：输出 `test-ok`

---

## 二、记忆工具（直接执行）

### 8. memory_hot_write — 写入热记忆

- 调用：`memory_hot_write`，参数 `key` 为 `test-key`，`value` 为 `test-value`
- 预期：写入成功

### 9. memory_hot_read — 读取热记忆

- 调用：`memory_hot_read`，参数 `key` 为 `test-key`
- 预期：返回 `test-value`

### 10. memory_append — 追加记忆

- 调用：`memory_append`，参数 `content` 为 `测试追加内容`
- 预期：追加成功

### 11. memory_search — 搜索记忆

- 调用：`memory_search`，参数 `query` 为 `测试`
- 预期：返回搜索结果

### 12. memory_update — 更新记忆

- 调用：`memory_update`，参数 `key` 为 `test-key`，`value` 为 `updated-value`
- 预期：更新成功

---

## 三、子 Agent 工具

### 13. Task — 委派子 Agent

- 调用：`Task`，参数 `description` 为 `echo hello`，`prompt` 为 `请回复 hello`
- 预期：子 Agent 执行并返回结果
- 注意：依赖 LLM 可用，如未配置可跳过

---

## 四、浏览器工具（reverse-request → Renderer）

### 14. BrowserNavigate — 导航到网页

- 调用：`BrowserNavigate`，参数 `url` 为 `https://www.baidu.com`
- 预期：右侧面板打开，显示百度页面

### 15. BrowserGetContent — 获取页面内容

- 先执行 BrowserNavigate，再调用 `BrowserGetContent`，参数 `type` 为 `markdown`
- 预期：返回页面 Markdown 内容

### 16. BrowserScreenshot — 截图

- 先执行 BrowserNavigate，再调用 `BrowserScreenshot`
- 预期：返回截图图片

### 17. BrowserSnapshot — 交互元素列表

- 先执行 BrowserNavigate，再调用 `BrowserSnapshot`
- 预期：返回页面可交互元素列表（选择器+描述）

### 18. BrowserClick — 点击元素

- 先执行 BrowserNavigate 到百度，再调用 `BrowserClick`，参数 `selector` 为 `#su` 或从 Snapshot 获取
- 预期：点击成功

### 19. BrowserType — 输入文本

- 先执行 BrowserNavigate 到百度，再调用 `BrowserType`，参数 `selector` 为 `#kw`，`text` 为 `测试`
- 预期：输入框填入文本

### 20. BrowserScroll — 滚动页面

- 先执行 BrowserNavigate，再调用 `BrowserScroll`，参数 `direction` 为 `down`
- 预期：页面向下滚动

### 21. BrowserEvaluate — 执行 JS

- 先执行 BrowserNavigate，再调用 `BrowserEvaluate`，参数 `code` 为 `return document.title`
- 预期：返回页面标题

---

## 五、桌面控制工具（reverse-request → Main）

### 22. DesktopScreenshot — 桌面截图

- 调用：`DesktopScreenshot`
- 预期：返回桌面截图

### 23. DesktopClick — 鼠标点击

- 调用：`DesktopClick`，参数 `x` 为 `100`，`y` 为 `100`
- 预期：模拟点击

### 24. DesktopType — 键盘输入

- 调用：`DesktopType`，参数 `text` 为 `hello`
- 预期：模拟键盘输入

### 25. DesktopScroll — 滚动

- 调用：`DesktopScroll`，参数 `direction` 为 `down`
- 预期：模拟滚动

### 26. DesktopWait — 等待

- 调用：`DesktopWait`，参数 `duration` 为 `1`（秒）
- 预期：等待 1 秒后返回

---

## 六、Web 工具

### 27. WebSearch — 网页搜索

- 调用：`WebSearch`，参数 `query` 为 `天气预报`
- 预期：返回搜索结果
- 注意：依赖搜索 API 配置

### 28. WebFetch — 抓取网页

- 调用：`WebFetch`，参数 `url` 为 `https://www.baidu.com`
- 预期：返回页面内容（Markdown）

---

## 七、用户交互工具

### 29. AskUserQuestion — 向用户提问

- 调用：`AskUserQuestion`，参数 `question` 为 `这是一个测试问题，请选择`，`options` 为 `["选项A", "选项B"]`
- 预期：弹出选择卡片，用户选择后返回结果

---

## 八、通知与定时任务

### 30. Notify — 桌面通知

- 调用：`Notify`，参数 `title` 为 `测试通知`，`message` 为 `这是一条测试消息`
- 预期：系统通知弹出

### 31. CronList — 列出定时任务

- 调用：`CronList`
- 预期：返回当前定时任务列表（可能为空）

### 32. CronCreate — 创建定时任务

- 调用：`CronCreate`，参数 `title` 为 `测试任务`，`schedule` 为 `0 0 9 * * *`，`prompt` 为 `测试`
- 预期：创建成功
- 注意：测试后应删除

### 33. CronDelete — 删除定时任务

- 先执行 CronCreate，再用返回的 id 调用 `CronDelete`
- 预期：删除成功

---

## 九、计划与目标

### 34. EnterPlanMode — 进入计划模式

- 调用：`EnterPlanMode`
- 预期：切换到计划模式

### 35. ExitPlanMode — 退出计划模式

- 先执行 EnterPlanMode，再调用 `ExitPlanMode`
- 预期：退出计划模式

### 36. get_goal — 获取当前目标

- 调用：`get_goal`
- 预期：返回当前目标（可能为空）

### 37. create_goal — 创建目标

- 调用：`create_goal`，参数 `goal` 为 `测试目标`
- 预期：创建成功

### 38. update_goal — 更新目标

- 先执行 create_goal，再调用 `update_goal` 更新状态
- 预期：更新成功

---

## 十、任务管理

### 39. TaskCreate — 创建任务

- 调用：`TaskCreate`，参数 `title` 为 `测试任务`，`description` 为 `测试描述`
- 预期：返回任务 ID

### 40. TaskGet — 获取任务

- 先执行 TaskCreate，再用返回的 id 调用 `TaskGet`
- 预期：返回任务详情

### 41. TaskUpdate — 更新任务

- 先执行 TaskCreate，再调用 `TaskUpdate` 更新状态为 `completed`
- 预期：更新成功

### 42. TaskList — 列出任务

- 调用：`TaskList`
- 预期：返回任务列表

---

## 十一、团队协作

### 43. TeamCreate — 创建团队

- 调用：`TeamCreate`，参数 `agents` 为一个简单的 agent 配置
- 预期：返回团队 ID

### 44. TeamStatus — 查看团队状态

- 先执行 TeamCreate，再调用 `TeamStatus`
- 预期：返回团队状态

### 45. SendMessage — 发送消息

- 先执行 TeamCreate，再调用 `SendMessage` 发送消息
- 预期：消息发送成功

### 46. TeamDelete — 删除团队

- 先执行 TeamCreate，再调用 `TeamDelete`
- 预期：删除成功

---

## 十二、图片生成

### 47. ImageGenerate — AI 图片生成

- 调用：`ImageGenerate`，参数 `prompt` 为 `a red circle`
- 预期：返回生成的图片
- 注意：依赖 OpenAI API Key 配置

---

## 十三、Notebook

### 48. NotebookEdit — 编辑 Jupyter Notebook

- 先创建一个简单的 .ipynb 文件，再调用 `NotebookEdit` 修改单元格内容
- 预期：Notebook 内容更新

---

## 十四、PowerShell 与监控

### 49. PowerShell — 执行 PowerShell 命令

- 调用：`PowerShell`，参数 `command` 为 `Write-Output "test-ok"`
- 预期：输出 `test-ok`

### 50. Monitor — 监控输出

- 调用：`Monitor`，监控一个正在运行的命令输出
- 预期：返回监控到的输出

---

## 十五、技能

### 51. Skill — 调用技能

- 调用：`Skill`，参数 `skillName` 为一个已安装的技能名
- 预期：执行技能并返回结果
- 注意：如无已安装技能可跳过

---

## 十六、Widget

### 52. visualize_show_widget — 展示 UI 组件

- 调用：`visualize_show_widget`，参数传入一个简单的 widget 配置
- 预期：在界面上展示组件

---

## 十七、渠道工具

> 渠道工具需要对应渠道已配置且连接成功，如未配置可跳过。

### 53. PluginSendMessage — 发送渠道消息

- 调用：`PluginSendMessage`，参数 `channel` 为 `feishu`，`message` 为 `test`
- 预期：消息发送成功

### 54. PluginListGroups — 列出群组

- 调用：`PluginListGroups`，参数 `channel` 为 `feishu`
- 预期：返回群组列表

### 55. FeishuSendImage — 飞书发图片

- 调用：`FeishuSendImage`，参数传入图片数据和目标会话
- 预期：图片发送成功

### 56. WeixinSendImage — 微信发图片

- 调用：`WeixinSendImage`
- 预期：图片发送成功
- 注意：微信渠道可能为 stub

---

## 十八、MCP 工具

### 57. mcp__* — MCP 工具调用

- 调用：`mcp__test__echo`（或任意已注册的 MCP 工具）
- 预期：MCP 服务器响应
- 注意：如无 MCP 服务器连接可跳过

---

## 汇总模板

测试完成后，按以下格式输出汇总：

| 序号 | 工具名 | 分类 | 结果 | 备注 |
|------|--------|------|------|------|
| 1 | Read | 文件 | ✅/❌/⏭️ | |
| 2 | Write | 文件 | ✅/❌/⏭️ | |
| ... | ... | ... | ... | ... |

### 统计

- 总计：57 项
- 通过：__ 项
- 失败：__ 项
- 跳过：__ 项
