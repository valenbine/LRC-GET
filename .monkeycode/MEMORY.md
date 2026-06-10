# 用户指令记忆

本文件记录了用户的指令、偏好和教导，用于在未来的交互中提供参考。

## 格式

### 用户指令条目
用户指令条目应遵循以下格式：

[用户指令摘要]
- Date: [YYYY-MM-DD]
- Context: [提及的场景或时间]
- Instructions:
  - [用户教导或指示的内容，逐行描述]

### 项目知识条目
Agent 在任务执行过程中发现的条目应遵循以下格式：

[项目知识摘要]
- Date: [YYYY-MM-DD]
- Context: Agent 在执行 [具体任务描述] 时发现
- Category: [运维部署|构建方法|测试方法|排错调试|工作流协作|环境配置]
- Instructions:
  - [具体的知识点，逐行描述]

## 去重策略

- 添加新条目前，检查是否存在相似或相同的指令
- 若发现重复，跳过新条目或与已有条目合并
- 合并时，更新上下文或日期信息
- 这有助于避免冗余条目，保持记忆文件整洁

## 条目

[构建与本地服务命令]
- Date: 2026-06-06
- Context: Agent 在整理 README 与部署说明时发现
- Category: 构建方法
- Instructions:
  - 本项目运行时使用 Node.js 18+，当前没有第三方 npm 运行时依赖。
  - 本地 Web 服务启动命令为 `npm run web`，可通过 `PORT=5173 npm run web` 指定端口。
  - CLI 可用性检查命令为 `npm run check`。
  - 前端脚本语法检查命令为 `node --check public/app.js`。

[测试与已知样本依赖]
- Date: 2026-06-06
- Context: Agent 在执行提交前验证时发现
- Category: 测试方法
- Instructions:
  - 封面兜底单测可用 `node --test --test-name-pattern "finds kugou cover image"` 单独运行。
  - `npm test` 包含 PC 本地 QRC 样本测试；样本文件缺失时，该特定测试会因 `ENOENT` 失败。

[GitHub 同步目标]
- Date: 2026-06-06
- Context: 用户要求同步到 GitHub 后确认
- Category: 工作流协作
- Instructions:
  - GitHub 远程仓库为 `https://github.com/valenbine/LRC-GET.git`。
  - 当前默认推送分支为 `master`，跟踪 `origin/master`。

[README 语言维护方式]
- Date: 2026-06-06
- Context: 用户要求 README 中英文分开并互相跳转
- Category: 工作流协作
- Instructions:
  - README 中文文档维护在 `README.md`。
  - README 英文文档维护在 `README.en.md`。
  - 两个 README 顶部需要保留语言切换链接，实现中英文互相跳转。

[项目作者与仓库信息]
- Date: 2026-06-06
- Context: 用户要求在前端展示作者联系方式
- Category: 工作流协作
- Instructions:
  - 项目作者展示为 `猫仙森MR CAT`。
  - 联系邮箱展示为 `valenbine@163.com`。
  - GitHub 仓库链接展示为 `https://github.com/valenbine/LRC-GET`。

[上下文压缩前归档]
- Date: 2026-06-09
- Context: 用户要求每次压缩上下文之前归档现有上下文
- Instructions:
  - 每次进行上下文压缩前，先将当前关键上下文、已完成事项、未完成事项、重要决策、阻塞点和相关文件路径归档到项目记忆或适合的项目文档中。

[浏览器端测试环境]
- Date: 2026-06-09
- Context: Agent 在执行深度测试时发现
- Category: 测试方法
- Instructions:
  - 浏览器端 E2E 可使用全局 Playwright：`npm install -g playwright`，并通过 `NODE_PATH=/usr/local/lib/node_modules` 让 Node 脚本加载全局包。
  - 首次使用需执行 `playwright install chromium` 下载 Chromium。
  - 当前环境运行 Chromium 需要安装系统库：`libglib2.0-0 libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libatspi2.0-0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2`。
