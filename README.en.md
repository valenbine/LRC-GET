# LRC-GET | Lyric Explorer

English | [简体中文](./README.md)

## About

LRC-GET is a lightweight tool for lyric collection, player lyric compatibility, and local music library management. It gets lyrics from QQ Music and NetEase Cloud Music, then converts the result into standard LRC files.

The project provides both a web UI and a CLI. The web UI supports local audio preview, online candidate selection, vinyl-style lyric playback visuals, and manual lyric timestamp marking. The CLI is designed for batch conversion, scripts, and local workflows.

LRC-GET currently has no third-party npm runtime dependencies. Its core logic is implemented with Node.js built-in modules, making it easy to deploy, audit, and extend.

It is suitable for users who need to generate LRC lyrics for local music libraries, players, subtitle tools, or music organization workflows. You can search online lyrics by title and artist, upload local lyric cache files for conversion, and manually mark timestamps in the browser when synced lyrics are unavailable.

## Features

- Decrypt QQ Music API hex QRC content and PC local `.qrc` / `.qm.qrc` cache files.
- Parse decrypted QRC XML `LyricContent` and QRC text timing data.
- Convert QRC line timing and word timing into standard LRC timestamps.
- Search QQ Music, NetEase Cloud Music, and LRCLIB lyric candidates.
- Select a specific online song ID and convert it directly to LRC.
- Fill album artwork from Apple Music/iTunes first, then provider fallbacks.
- Preview audio locally in the browser without uploading the audio file to the server.
- Mark timestamps manually for plain lyrics when synced lyrics are missing.
- Export decrypted XML/text for inspection.

## Tech Stack

- Runtime: Node.js 18+ with native ESM.
- Server: Node.js built-in `http`, `fs`, `path`, and `zlib` modules.
- Frontend: vanilla HTML, CSS, and JavaScript.
- Dependencies: no runtime third-party npm packages.
- Tests: Node.js built-in test runner.

## Architecture

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

## Install

```bash
git clone https://github.com/valenbine/LRC-GET.git
cd LRC-GET
```

No package installation is required for runtime use because the project currently uses only Node.js built-in modules.

## Web Usage

```bash
npm run web
```

Open the printed local URL, usually:

```text
http://localhost:5173
```

Deployment notes:

- Set `PORT` to choose the listening port.
- The server listens on `0.0.0.0`, so it can run behind a reverse proxy or container port mapping.
- Audio files selected in the browser stay local and are played through `URL.createObjectURL()`.
- QRC/text lyric files are sent to the local Node.js server for conversion.

Production-style start example:

```bash
PORT=5173 npm run web
```

## CLI Usage

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

## API Usage

```js
import { decryptQrc, parseQrcXml, toLrc } from './src/qrc2lrc.js'

const xml = decryptQrc(encryptedHex)
const lines = parseQrcXml(xml)
const lrc = toLrc(lines)
```

## HTTP Endpoints

### `POST /api/search`

Search online lyric candidates.

```json
{
  "searchTitle": "晴天",
  "searchArtist": "周杰伦",
  "provider": "auto"
}
```

`provider` can be `auto`, `qqmusic`, `netease`, or `lrclib`.

### `POST /api/convert`

Convert local QRC/XML/text input or a selected online candidate.

Important fields:

- `qrc`: base64 binary QRC or text content.
- `qrcEncoding`: `base64` or `text`.
- `mode`: `encrypted` or `xml`.
- `selectedSongId`: online song ID for direct candidate conversion.

## How QRC Conversion Works

1. API hex QRC input is normalized into encrypted bytes.
2. PC local QQ Music cache files are unmasked with the QMC dynamic mask and parsed after the `[offset:n]` header.
3. Encrypted QRC bytes are decrypted with QQ Music's custom DES/3DES-compatible bit-level routine.
4. The decrypted payload is inflated with zlib.
5. `LyricContent` is extracted from QRC XML or the text body is parsed directly.
6. QRC timestamps are flattened into standard LRC timestamps.

## Public Open-Source References

This project uses its own Node.js implementation, while referencing public open-source work and public service APIs listed below.

- [`tomakino/qrckit`](https://github.com/tomakino/qrckit): referenced the QQ Music API-style QRC payload handling idea, encrypted input shape, and Kotlin decoding flow. This project reimplements the related flow in Node.js.
- [`WXRIW/QQMusicDecoder`](https://github.com/WXRIW/QQMusicDecoder): referenced the QQ Music custom DES/3DES-compatible bit-level decoding technique. This project ports the core bit operation flow into `src/des-helper.js`.
- [`magic-akari/lrc-maker`](https://github.com/magic-akari/lrc-maker): referenced the manual LRC timestamp marking interaction model, including line-by-line marking, keyboard controls, and timeline validation ideas. This project does not import its React/Vite/wavesurfer stack.
- QQ Music public web endpoints: lyric candidate search and lyric fetching.
- NetEase Cloud Music public web endpoints: lyric search and LRC fetching.
- LRCLIB public API: synced and plain lyric lookup.
- Apple iTunes Search API: album artwork fallback.
- Kugou public search endpoint: legacy album artwork fallback path.

The referenced projects remain owned by their original authors. Service API availability depends on each provider.

## Testing

```bash
npm run check
node --check public/app.js
node --check src/server.js
node --check test/qrc2lrc.test.js
node --test --test-name-pattern "finds kugou cover image"
npm test
```

`npm test` includes a PC local QRC sample test. If the sample file is absent, that case is skipped automatically to keep clean environments green.

Browser E2E checks can be run manually with Playwright. Playwright is not a runtime dependency of this repository; install it globally when browser interaction needs to be verified:

```bash
npm install -g playwright
playwright install chromium
```

The verified browser flow covers searching `晴天 / 周杰伦`, selecting an online candidate, converting to LRC, lyric rendering, mobile layout, author card, mini player, and the basic manual timestamp marking interaction.

## Deployment

### Local

```bash
PORT=5173 npm run web
```

### Node.js Process Manager

Use any Node.js process manager or system service that can run:

```bash
npm run web
```

Recommended environment:

- Node.js 18 or newer.
- Reverse proxy forwards HTTP traffic to the configured `PORT`.
- Outbound HTTPS access is available for online lyric and cover search.

## Scope and Limitations

- Local QRC cache files can contain plain lyrics without timestamps; those are displayed as static lyrics.
- Online timestamp completion depends on matching results returned by QQ Music, NetEase Cloud Music, or LRCLIB.
- Album artwork availability depends on public search endpoints.
- Browser audio preview is local-only.

## License

This project is released under the MIT License. See [`LICENSE`](./LICENSE) for details.
