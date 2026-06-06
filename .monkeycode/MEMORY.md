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
