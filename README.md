# LRC-GET | 词探

## About / 简介

LRC-GET 词探 is a lightweight Node.js tool and web app for decrypting QQ Music QRC lyrics, searching online lyric candidates, and converting them into standard LRC files.

LRC-GET 词探是一个轻量级 Node.js 工具与 Web 应用，用于解密 QQ 音乐 QRC 歌词、搜索在线歌词候选，并转换为标准 LRC 文件。

It focuses on practical lyric conversion workflows: local QQ Music cache files, API-style QRC hex content, online lyric lookup, optional local audio preview, and manual lyric timestamp marking when an official synced lyric is unavailable.

项目聚焦实用歌词转换流程：本地 QQ 音乐缓存文件、API 型 QRC hex 内容、在线歌词搜索、本地音频预览，以及官方同步歌词缺失时的手动歌词时间戳标注。

## Features / 功能

- Decrypt QQ Music API hex QRC content and PC local `.qrc` / `.qm.qrc` cache files.
- 解密 QQ 音乐 API hex QRC 内容和 PC 本地 `.qrc` / `.qm.qrc` 缓存文件。
- Parse decrypted QRC XML `LyricContent` and QRC text timing data.
- 解析已解密 QRC XML `LyricContent` 与 QRC 文本时间轴数据。
- Convert QRC line timing and word timing into standard LRC timestamps.
- 将 QRC 行级时间轴与逐字时间轴转换为标准 LRC 时间戳。
- Search QQ Music, NetEase Cloud Music, and LRCLIB lyric candidates.
- 搜索 QQ 音乐、网易云音乐和 LRCLIB 歌词候选。
- Select a specific online song ID and convert it directly to LRC.
- 选择指定在线 song ID 并直接转换为 LRC。
- Fill album cover artwork from Apple Music/iTunes first, then provider fallbacks.
- 优先使用 Apple Music/iTunes 补充专辑封面，并保留其他来源兜底。
- Preview audio locally in the browser without uploading the audio file to the server.
- 在浏览器本地预览音频，音频文件不会上传到服务端。
- Mark timestamps manually for plain lyrics when synced lyrics are missing.
- 当同步歌词缺失时，可为纯文本歌词手动标注时间戳。
- Export decrypted XML/text for inspection.
- 支持导出已解密 XML/文本用于检查。

## Tech Stack / 技术栈

- Runtime: Node.js 18+ with native ESM.
- 运行时：Node.js 18+，原生 ESM。
- Server: Node.js built-in `http`, `fs`, `path`, and `zlib` modules.
- 服务端：Node.js 内置 `http`、`fs`、`path`、`zlib` 模块。
- Frontend: vanilla HTML, CSS, and JavaScript.
- 前端：原生 HTML、CSS、JavaScript。
- Dependencies: no runtime third-party npm packages.
- 依赖：无第三方 npm 运行时依赖。
- Tests: Node.js built-in test runner.
- 测试：Node.js 内置 test runner。

## Architecture / 架构

```text
Browser UI
  -> static files from public/
  -> POST /api/search
  -> POST /api/convert

Node.js Web Server
  -> src/server.js
  -> provider search modules
  -> QRC decrypt and LRC conversion core

Core Modules
  -> src/qrc2lrc.js       QRC normalization, PC cache unmasking, DES decrypt, zlib inflate, QRC parse, LRC output
  -> src/des-helper.js    QQ Music custom DES/3DES-compatible bit-level implementation
  -> src/qqmusic-api.js   QQ Music lyric candidate search and selected song lyric fetch
  -> src/netease-api.js   NetEase Cloud Music search and LRC fetch
  -> src/lrclib-api.js    LRCLIB search and LRC fetch
  -> src/kugou-cover-api.js Cover fallback lookup with Apple/iTunes, Kugou, and NetEase strategies
  -> src/cli.js           Command-line interface
```

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

## Install / 安装

```bash
git clone https://github.com/valenbine/LRC-GET.git
cd LRC-GET
```

No package installation is required for runtime use because the project currently uses only Node.js built-in modules.

项目当前只使用 Node.js 内置模块，运行时无需安装第三方依赖。

## Web Usage / Web 使用

```bash
npm run web
```

Open the printed local URL, usually:

打开终端输出的本地地址，通常是：

```text
http://localhost:5173
```

Deployment notes:

部署说明：

- Set `PORT` to choose the listening port.
- 使用 `PORT` 指定监听端口。
- The server listens on `0.0.0.0`, so it can run behind a reverse proxy or container port mapping.
- 服务监听 `0.0.0.0`，可放在反向代理或容器端口映射后运行。
- Audio files selected in the browser stay local and are played through `URL.createObjectURL()`.
- 浏览器选择的音频文件保留在本地，通过 `URL.createObjectURL()` 播放。
- QRC/text lyric files are sent to the local Node.js server for conversion.
- QRC/文本歌词文件会发送到本地 Node.js 服务用于转换。

Example production-style start:

生产风格启动示例：

```bash
PORT=5173 npm run web
```

## CLI Usage / 命令行使用

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

## API Usage / API 使用

```js
import { decryptQrc, parseQrcXml, toLrc } from './src/qrc2lrc.js'

const xml = decryptQrc(encryptedHex)
const lines = parseQrcXml(xml)
const lrc = toLrc(lines)
```

## HTTP Endpoints / HTTP 接口

### `POST /api/search`

Search online lyric candidates.

搜索在线歌词候选。

```json
{
  "searchTitle": "晴天",
  "searchArtist": "周杰伦",
  "provider": "auto"
}
```

`provider` can be `auto`, `qqmusic`, `netease`, or `lrclib`.

`provider` 可选 `auto`、`qqmusic`、`netease`、`lrclib`。

### `POST /api/convert`

Convert local QRC/XML/text input or a selected online candidate.

转换本地 QRC/XML/文本输入，或转换指定在线候选。

Important fields:

关键字段：

- `qrc`: base64 binary QRC or text content.
- `qrc`：base64 二进制 QRC 或文本内容。
- `qrcEncoding`: `base64` or `text`.
- `qrcEncoding`：`base64` 或 `text`。
- `mode`: `encrypted` or `xml`.
- `mode`：`encrypted` 或 `xml`。
- `selectedSongId`: online song ID for direct candidate conversion.
- `selectedSongId`：用于直接转换在线候选的歌曲 ID。

## How QRC Conversion Works / QRC 转换原理

1. API hex QRC input is normalized into encrypted bytes.
2. API 型 hex QRC 输入会先归一化为加密字节。
3. PC local QQ Music cache files are unmasked with the QMC dynamic mask and parsed after the `[offset:n]` header.
4. PC 本地 QQ 音乐缓存文件会先通过 QMC dynamic mask 解掩码，再解析 `[offset:n]` 头之后的内容。
5. Encrypted QRC bytes are decrypted with QQ Music's custom DES/3DES-compatible bit-level routine.
6. 加密 QRC 字节通过 QQ 音乐自定义 DES/3DES 兼容位级流程解密。
7. The decrypted payload is inflated with zlib.
8. 解密后的 payload 使用 zlib 解压。
9. `LyricContent` is extracted from QRC XML or the text body is parsed directly.
10. 从 QRC XML 中提取 `LyricContent`，或直接解析文本主体。
11. QRC timestamps are flattened into standard LRC timestamps.
12. QRC 时间轴会被转换为标准 LRC 时间戳。

## Public Open-Source References / 公开开源技术参考

This project uses its own Node.js implementation, while referencing public open-source work and public service APIs listed below.

项目使用自有 Node.js 实现，同时参考了下列公开开源项目和公开服务 API。

- `tomakino/qrckit`: QRC decrypting idea and Kotlin reference implementation for QQ Music API-style QRC payloads.
- `tomakino/qrckit`：参考 QQ 音乐 API 型 QRC payload 的解密思路与 Kotlin 实现。
- `WXRIW/QQMusicDecoder`: QQ Music custom DES/3DES-compatible bit-level decoder reference.
- `WXRIW/QQMusicDecoder`：参考 QQ 音乐自定义 DES/3DES 兼容位级解码实现。
- `magic-akari/lrc-maker`: interaction reference for manual LRC timestamp marking workflows.
- `magic-akari/lrc-maker`：参考手动 LRC 时间戳标注的交互模型。
- QQ Music public web endpoints: lyric candidate search and lyric fetching.
- QQ 音乐公开 Web 接口：歌词候选搜索与歌词拉取。
- NetEase Cloud Music public web endpoints: lyric search and LRC fetching.
- 网易云音乐公开 Web 接口：歌词搜索与 LRC 拉取。
- LRCLIB public API: synced and plain lyric lookup.
- LRCLIB 公开 API：同步歌词与纯文本歌词查询。
- Apple iTunes Search API: album artwork fallback.
- Apple iTunes Search API：专辑封面兜底。
- Kugou public search endpoint: legacy album artwork fallback path.
- 酷狗公开搜索接口：历史封面兜底路径。

The referenced projects remain owned by their original authors. Service API availability depends on each provider.

上述参考项目归原作者所有。服务 API 可用性取决于对应服务提供方。

## Testing / 测试

```bash
npm run check
node --check public/app.js
node --check src/server.js
node --test --test-name-pattern "finds kugou cover image"
npm test
```

`npm test` includes a PC local QRC sample test. If the sample file is absent, that specific test will fail with `ENOENT`.

`npm test` 包含 PC 本地 QRC 样本测试。样本文件缺失时，该测试会因 `ENOENT` 失败。

## Deployment / 部署

### Local / 本地

```bash
PORT=5173 npm run web
```

### Node.js process manager / Node.js 进程管理器

Use any Node.js process manager or system service that can run:

可使用任意 Node.js 进程管理器或系统服务运行：

```bash
npm run web
```

Recommended environment:

推荐环境：

- Node.js 18 or newer.
- Node.js 18 或更高版本。
- Reverse proxy forwards HTTP traffic to the configured `PORT`.
- 反向代理将 HTTP 流量转发到配置的 `PORT`。
- Outbound HTTPS access is available for online lyric and cover search.
- 允许出站 HTTPS 访问，用于在线歌词与封面搜索。

## Scope and Limitations / 范围与限制

- Local QRC cache files can contain plain lyrics without timestamps; those are displayed as static lyrics.
- 本地 QRC 缓存文件可能只包含无时间轴纯文本歌词，此类歌词会以静态歌词显示。
- Online timestamp completion depends on matching results returned by QQ Music, NetEase Cloud Music, or LRCLIB.
- 在线补时间轴依赖 QQ 音乐、网易云音乐或 LRCLIB 返回匹配结果。
- Album artwork availability depends on public search endpoints.
- 专辑封面可用性取决于公开搜索接口。
- Browser audio preview is local-only.
- 浏览器音频预览仅在本地进行。

## License / 许可证

This project is released under the MIT License. See `LICENSE` for details.

本项目基于 MIT License 发布。详情见 `LICENSE`。
