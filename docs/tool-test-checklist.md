# 工具测试清单（待测）— Agent 自测用

> 已排除首轮测试通过的 31 项（✅），仅保留跳过的 26 项待测。
> 用法：逐条调用工具并记录结果，标记 ✅ / ❌（附错误信息）。
> 测试完成后更新 docs/tool-test-results.md。

---

## 一、桌面控制工具（reverse-request → Main）

### 1. DesktopScroll — 滚动

- 调用：`DesktopScroll`，参数 `direction` 为 `down`
- 预期：模拟滚动

### 2. DesktopWait — 等待

- 调用：`DesktopWait`，参数 `duration` 为 `1`（秒）
- 预期：等待 1 秒后返回

---

## 二、Web 工具

### 3. WebSearch — 网页搜索

- 调用：`WebSearch`，参数 `query` 为 `天气预报`
- 预期：返回搜索结果
- 注意：前端为 stub，实际执行在 .NET 端，需确认 native agent 是否支持

---

## 三、用户交互工具

### 4. AskUserQuestion — 向用户提问

- 调用：`AskUserQuestion`，参数 `question` 为 `这是一个测试问题，请选择`，`options` 为 `["选项A", "选项B"]`
- 预期：弹出选择卡片，用户选择后返回结果

---

## 四、通知与定时任务

### 5. CronDelete — 删除定时任务

- 先执行 CronCreate，再用返回的 id 调用 `CronDelete`
- 预期：删除成功

---

## 五、计划与目标

### 6. EnterPlanMode — 进入计划模式

- 调用：`EnterPlanMode`
- 预期：切换到计划模式

### 7. ExitPlanMode — 退出计划模式

- 先执行 EnterPlanMode，再调用 `ExitPlanMode`
- 预期：退出计划模式

### 8. update_goal — 更新目标

- 先执行 create_goal，再调用 `update_goal` 更新状态
- 预期：更新成功

---

## 六、任务管理

### 9. TaskList — 列出任务

- 调用：`TaskList`
- 预期：返回任务列表

---

## 七、团队协作

### 10. TeamCreate — 创建团队

- 调用：`TeamCreate`，参数 `agents` 为一个简单的 agent 配置
- 预期：返回团队 ID

### 11. TeamStatus — 查看团队状态

- 先执行 TeamCreate，再调用 `TeamStatus`
- 预期：返回团队状态

### 12. SendMessage — 发送消息

- 先执行 TeamCreate，再调用 `SendMessage` 发送消息
- 预期：消息发送成功

### 13. TeamDelete — 删除团队

- 先执行 TeamCreate，再调用 `TeamDelete`
- 预期：删除成功

---

## 八、图片生成

### 14. ImageGenerate — AI 图片生成

- 调用：`ImageGenerate`，参数 `prompt` 为 `a red circle`
- 预期：返回生成的图片
- 注意：依赖 OpenAI API Key 配置

---

## 九、Notebook

### 15. NotebookEdit — 编辑 Jupyter Notebook

- 先创建一个简单的 .ipynb 文件，再调用 `NotebookEdit` 修改单元格内容
- 预期：Notebook 内容更新

---

## 十、监控

### 16. Monitor — 监控输出

- 调用：`Monitor`，监控一个正在运行的命令输出
- 预期：返回监控到的输出

---

## 十一、技能

### 17. Skill — 调用技能

- 调用：`Skill`，参数 `skillName` 为一个已安装的技能名
- 预期：执行技能并返回结果
- 注意：如无已安装技能可跳过

---

## 十二、Widget

### 18. visualize_show_widget — 展示 UI 组件

- 调用：`visualize_show_widget`，参数传入一个简单的 widget 配置
- 预期：在界面上展示组件

---

## 十三、渠道工具

> 渠道工具需要对应渠道已配置且连接成功，如未配置可跳过。

### 19. PluginSendMessage — 发送渠道消息

- 调用：`PluginSendMessage`，参数 `channel` 为 `feishu`，`message` 为 `test`
- 预期：消息发送成功

### 20. PluginListGroups — 列出群组

- 调用：`PluginListGroups`，参数 `channel` 为 `feishu`
- 预期：返回群组列表

### 21. FeishuSendImage — 飞书发图片

- 调用：`FeishuSendImage`，参数传入图片数据和目标会话
- 预期：图片发送成功

### 22. WeixinSendImage — 微信发图片

- 调用：`WeixinSendImage`
- 预期：图片发送成功
- 注意：微信渠道可能为 stub

---

## 十四、MCP 工具

### 23. mcp__* — MCP 工具调用

- 调用：`mcp__test__echo`（或任意已注册的 MCP 工具）
- 预期：MCP 服务器响应
- 注意：如无 MCP 服务器连接可跳过

---

## 汇总模板

测试完成后，按以下格式输出汇总：

| 序号 | 工具名 | 分类 | 结果 | 备注 |
|------|--------|------|------|------|
| 1 | DesktopScroll | 桌面控制 | ✅/❌/⏭️ | |
| 2 | DesktopWait | 桌面控制 | ✅/❌/⏭️ | |
| ... | ... | ... | ... | ... |

### 统计

- 总计：23 项
- 通过：__ 项
- 失败：__ 项
- 跳过：__ 项
