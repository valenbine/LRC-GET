# LRC-GET | 词探

[English](./README.en.md) | 简体中文

## About

LRC-GET 词探是一个面向歌词整理、播放器歌词适配和本地音乐管理的轻量级工具。它可以获取 QQ 音乐、网易云音乐歌词，并将结果转换为标准 LRC 文件。

项目提供 Web 界面和 CLI 两种入口。Web 界面支持本地音频预览、在线候选选择、黑胶播放器视觉预览和歌词时间戳标注；CLI 适合批处理、脚本集成和本地转换。

本项目不依赖第三方 npm 运行时包，核心逻辑基于 Node.js 内置模块实现，便于部署、审计和二次开发。

适合需要为本地音乐库、播放器、字幕工具或音乐整理流程批量生成 LRC 歌词的用户使用。你可以通过歌名和歌手搜索在线歌词，也可以上传本地歌词缓存文件进行转换；当在线歌词没有时间轴时，还可以在浏览器里手动标注时间戳。

## 功能

- 解密 QQ 音乐 API hex QRC 内容和 PC 本地 `.qrc` / `.qm.qrc` 缓存文件。
- 解析已解密 QRC XML `LyricContent` 与 QRC 文本时间轴数据。
- 将 QRC 行级时间轴与逐字时间轴转换为标准 LRC 时间戳。
- 搜索 QQ 音乐、网易云音乐和 LRCLIB 歌词候选。
- 选择指定在线 song ID 并直接转换为 LRC。
- 优先使用 Apple Music/iTunes 补充专辑封面，并保留其他来源兜底。
- 在浏览器本地预览音频，音频文件不会上传到服务端。
- 当同步歌词缺失时，可为纯文本歌词手动标注时间戳。
- 支持导出已解密 XML/文本用于检查。

## 技术栈

- 运行时：Node.js 18+，原生 ESM。
- 服务端：Node.js 内置 `http`、`fs`、`path`、`zlib` 模块。
- 前端：原生 HTML、CSS、JavaScript。
- 依赖：无第三方 npm 运行时依赖。
- 测试：Node.js 内置 test runner。

## 架构

```text
浏览器界面
  -> 加载 public/ 静态文件
  -> POST /api/search
  -> POST /api/convert

Node.js Web 服务
  -> src/server.js
  -> 调用各歌词来源模块
  -> 调用 QRC 解密与 LRC 转换核心

核心模块
  -> src/qrc2lrc.js       QRC 归一化、PC 缓存解掩码、DES 解密、zlib 解压、QRC 解析、LRC 输出
  -> src/des-helper.js    QQ 音乐自定义 DES/3DES 兼容位级实现
  -> src/qqmusic-api.js   QQ 音乐歌词候选搜索与指定歌曲歌词获取
  -> src/netease-api.js   网易云音乐搜索与 LRC 获取
  -> src/lrclib-api.js    LRCLIB 搜索与 LRC 获取
  -> src/kugou-cover-api.js Apple/iTunes、酷狗、网易云封面兜底策略
  -> src/cli.js           命令行入口
```

## 安装

```bash
git clone https://github.com/valenbine/LRC-GET.git
cd LRC-GET
```

项目当前只使用 Node.js 内置模块，运行时无需安装第三方依赖。

## Web 使用

```bash
npm run web
```

打开终端输出的本地地址，通常是：

```text
http://localhost:5173
```

部署说明：

- 使用 `PORT` 指定监听端口。
- 服务监听 `0.0.0.0`，可放在反向代理或容器端口映射后运行。
- 浏览器选择的音频文件保留在本地，通过 `URL.createObjectURL()` 播放。
- QRC/文本歌词文件会发送到本地 Node.js 服务用于转换。

生产风格启动示例：

```bash
PORT=5173 npm run web
```

## CLI 使用

```bash
# Convert encrypted QRC hex file or PC local .qm.qrc cache file to LRC
node src/cli.js --input encrypted.qrc --output lyrics.lrc

# Print LRC to stdout from encrypted hex
node src/cli.js --text E9056DD20F5E...

# Convert already decrypted XML or QRC text
node src/cli.js --xml --input decrypted.xml --output lyrics.lrc

# Save decrypted XML/text only
node src/cli.js --input encrypted.qrc --output-xml decrypted.xml

# Search QQ Music online and output the best timestamped LRC candidate
node src/cli.js --search-title "晴天" --search-artist "周杰伦" --provider qqmusic --output lyrics.lrc

# Search NetEase Cloud Music online
node src/cli.js --search-title "晴天" --search-artist "周杰伦" --provider netease --output lyrics.lrc

# Search LRCLIB online
node src/cli.js --search-title "晴天" --search-artist "周杰伦" --provider lrclib --output lyrics.lrc

# List online lyric candidates and timestamp coverage
node src/cli.js --search-title "晴天" --search-artist "周杰伦" --provider lrclib --list-matches

# Use a specific online song ID from the candidate list
node src/cli.js --search-title "晴天" --search-artist "周杰伦" --provider netease --song-id 186016 --output lyrics.lrc
```

## API 使用

```js
import { decryptQrc, parseQrcXml, toLrc } from './src/qrc2lrc.js'

const xml = decryptQrc(encryptedHex)
const lines = parseQrcXml(xml)
const lrc = toLrc(lines)
```

## HTTP 接口

### `POST /api/search`

搜索在线歌词候选。

```json
{
  "searchTitle": "晴天",
  "searchArtist": "周杰伦",
  "provider": "auto"
}
```

`provider` 可选 `auto`、`qqmusic`、`netease`、`lrclib`。

### `POST /api/convert`

转换本地 QRC/XML/文本输入，或转换指定在线候选。

关键字段：

- `qrc`：base64 二进制 QRC 或文本内容。
- `qrcEncoding`：`base64` 或 `text`。
- `mode`：`encrypted` 或 `xml`。
- `selectedSongId`：用于直接转换在线候选的歌曲 ID。

## QRC 转换原理

1. API 型 hex QRC 输入会先归一化为加密字节。
2. PC 本地 QQ 音乐缓存文件会先通过 QMC dynamic mask 解掩码，再解析 `[offset:n]` 头之后的内容。
3. 加密 QRC 字节通过 QQ 音乐自定义 DES/3DES 兼容位级流程解密。
4. 解密后的 payload 使用 zlib 解压。
5. 从 QRC XML 中提取 `LyricContent`，或直接解析文本主体。
6. QRC 时间轴会被转换为标准 LRC 时间戳。

## 公开开源技术参考

本项目使用自有 Node.js 实现，同时参考了下列公开开源项目和公开服务 API。

- [`tomakino/qrckit`](https://github.com/tomakino/qrckit)：参考 QQ 音乐 API 型 QRC payload 的处理思路、密文输入形态和 Kotlin 解码流程说明。本项目使用 Node.js 重新实现相关流程。
- [`WXRIW/QQMusicDecoder`](https://github.com/WXRIW/QQMusicDecoder)：参考 QQ 音乐自定义 DES/3DES 兼容位级解码技术。本项目将核心位运算流程移植为 `src/des-helper.js`。
- [`magic-akari/lrc-maker`](https://github.com/magic-akari/lrc-maker)：借鉴手动 LRC 时间戳标注的交互模型，包括逐行标注、快捷键控制和时间轴校验思路。本项目未引入其 React/Vite/wavesurfer 技术栈。
- QQ 音乐公开 Web 接口：歌词候选搜索与歌词拉取。
- 网易云音乐公开 Web 接口：歌词搜索与 LRC 拉取。
- LRCLIB 公开 API：同步歌词与纯文本歌词查询。
- Apple iTunes Search API：专辑封面兜底。
- 酷狗公开搜索接口：历史封面兜底路径。

上述参考项目归原作者所有。服务 API 可用性取决于对应服务提供方。

## 测试

```bash
npm run check
node --check public/app.js
node --check src/server.js
node --check test/qrc2lrc.test.js
node --test --test-name-pattern "finds kugou cover image"
npm test
```

`npm test` 包含 PC 本地 QRC 样本测试。样本文件缺失时，该用例会自动跳过，避免干净环境误报失败。

浏览器端 E2E 可使用 Playwright 手动执行。当前仓库不把 Playwright 作为运行时依赖；如需复测 Web 交互，可全局安装并运行 Chromium：

```bash
npm install -g playwright
playwright install chromium
```

当前已验证的浏览器流程包括：搜索 `晴天 / 周杰伦`、选择在线候选、转换 LRC、歌词渲染、移动端布局、作者卡、迷你播放器和歌词时间戳标注基础交互。

## 部署

### 本地部署

```bash
PORT=5173 npm run web
```

### Node.js 进程管理器

可使用任意 Node.js 进程管理器或系统服务运行：

```bash
npm run web
```

推荐环境：

- Node.js 18 或更高版本。
- 反向代理将 HTTP 流量转发到配置的 `PORT`。
- 允许出站 HTTPS 访问，用于在线歌词与封面搜索。

## 范围与限制

- 本地 QRC 缓存文件可能只包含无时间轴纯文本歌词，此类歌词会以静态歌词显示。
- 在线补时间轴依赖 QQ 音乐、网易云音乐或 LRCLIB 返回匹配结果。
- 专辑封面可用性取决于公开搜索接口。
- 浏览器音频预览仅在本地进行。

## 许可证

本项目基于 MIT License 发布。详情见 [`LICENSE`](./LICENSE)。
