# 工具测试清单（待测）— Agent 自测用

> 已排除首轮测试通过的 31 项（✅），保留所有跳过的 25 项待测。
> 用法：逐条调用工具并记录结果，标记 ✅ / ❌（附错误信息）。
> 测试完成后更新 docs/tool-test-results.md。

---

## 一、浏览器工具（1 项）

### 1. BrowserClick — 点击元素

- 前置：BrowserNavigate 到百度首页，BrowserSnapshot 获取元素列表
- 调用：`BrowserClick`，参数 `selector` 为搜索框或按钮
- 预期：元素被点击，页面响应

---

## 二、桌面控制工具（4 项）

### 2. DesktopClick — 模拟点击

- 调用：`DesktopClick`，参数 `x`/`y` 为屏幕上一个有效坐标
- 预期：模拟鼠标点击

### 3. DesktopType — 模拟键盘输入

- 调用：`DesktopType`，参数 `text` 为 `hello`
- 预期：模拟键盘输入文字

### 4. DesktopScroll — 滚动

- 调用：`DesktopScroll`，参数 `direction` 为 `down`
- 预期：模拟滚动

### 5. DesktopWait — 等待

- 调用：`DesktopWait`，参数 `duration` 为 `1`（秒）
- 预期：等待 1 秒后返回

---

## 三、Web 工具（1 项）

### 6. WebSearch — 网页搜索

- 调用：`WebSearch`，参数 `query` 为 `天气预报`
- 预期：返回搜索结果
- 注意：前端为 stub，实际执行在 .NET 端，需确认 native agent 是否支持

---

## 四、用户交互工具（1 项）

### 7. AskUserQuestion — 向用户提问

- 调用：`AskUserQuestion`，参数 `question` 为 `这是一个测试问题，请选择`，`options` 为 `["选项A", "选项B"]`
- 预期：弹出选择卡片，用户选择后返回结果

---

## 五、通知与定时任务（1 项）

### 8. CronDelete — 删除定时任务

- 前置：先执行 CronCreate，获取返回的 id
- 调用：`CronDelete`，参数 `id` 为上一步返回的任务 ID
- 预期：删除成功

---

## 六、计划与目标（3 项）

### 9. EnterPlanMode — 进入计划模式

- 调用：`EnterPlanMode`
- 预期：切换到计划模式

### 10. ExitPlanMode — 退出计划模式

- 前置：先执行 EnterPlanMode
- 调用：`ExitPlanMode`
- 预期：退出计划模式

### 11. update_goal — 更新目标

- 前置：先执行 create_goal 创建一个目标
- 调用：`update_goal`，更新目标状态（如 `status` 改为 `completed`）
- 预期：更新成功

---

## 七、任务管理（1 项）

### 12. TaskList — 列出任务

- 前置：先执行 TaskCreate 创建至少一个任务
- 调用：`TaskList`
- 预期：返回任务列表

---

## 八、团队协作（4 项）

### 13. TeamCreate — 创建团队

- 调用：`TeamCreate`，参数 `agents` 为一个简单的 agent 配置
- 预期：返回团队 ID

### 14. TeamStatus — 查看团队状态

- 前置：先执行 TeamCreate
- 调用：`TeamStatus`
- 预期：返回团队状态

### 15. SendMessage — 发送消息

- 前置：先执行 TeamCreate
- 调用：`SendMessage`，发送一条测试消息
- 预期：消息发送成功

### 16. TeamDelete — 删除团队

- 前置：先执行 TeamCreate
- 调用：`TeamDelete`
- 预期：删除成功

---

## 九、图片生成（1 项）

### 17. ImageGenerate — AI 图片生成

- 调用：`ImageGenerate`，参数 `prompt` 为 `a red circle`
- 预期：返回生成的图片
- 注意：依赖 API Key 配置

---

## 十、Notebook（1 项）

### 18. NotebookEdit — 编辑 Jupyter Notebook

- 前置：创建一个简单的 .ipynb 文件
- 调用：`NotebookEdit`，修改单元格内容
- 预期：Notebook 内容更新

---

## 十一、监控（1 项）

### 19. Monitor — 监控输出

- 调用：`Monitor`，监控一个正在运行的命令输出
- 预期：返回监控到的输出

---

## 十二、技能与 Widget（2 项）

### 20. Skill — 调用技能

- 调用：`Skill`，参数 `skillName` 为一个已安装的技能名
- 预期：执行技能并返回结果
- 注意：如无已安装技能可跳过

### 21. visualize_show_widget — 展示 UI 组件

- 调用：`visualize_show_widget`，参数传入一个简单的 widget 配置
- 预期：在界面上展示组件

---

## 十三、渠道工具（4 项）

> 渠道工具需要对应渠道已配置且连接成功，如未配置可跳过。

### 22. PluginSendMessage — 发送渠道消息

- 调用：`PluginSendMessage`，参数 `channel` 为 `feishu`，`message` 为 `test`
- 预期：消息发送成功

### 23. PluginListGroups — 列出群组

- 调用：`PluginListGroups`，参数 `channel` 为 `feishu`
- 预期：返回群组列表

### 24. FeishuSendImage — 飞书发图片

- 调用：`FeishuSendImage`，参数传入图片数据和目标会话
- 预期：图片发送成功

### 25. WeixinSendImage — 微信发图片

- 调用：`WeixinSendImage`
- 预期：图片发送成功
- 注意：微信渠道可能为 stub

---

## 汇总模板

测试完成后，按以下格式输出汇总：

| 序号 | 工具名 | 分类 | 结果 | 备注 |
|------|--------|------|------|------|
| 1 | BrowserClick | 浏览器 | ✅/❌/⏭️ | |
| 2 | DesktopClick | 桌面控制 | ✅/❌/⏭️ | |
| ... | ... | ... | ... | ... |

### 统计

- 总计：25 项
- 通过：__ 项
- 失败：__ 项
- 跳过：__ 项
