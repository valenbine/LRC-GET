# LRC-GET词探

LRC-GET词探 gets online lyrics and converts QQ Music encrypted QRC lyric content into standard LRC files.

The project focuses on local QQ Music QRC decryption, online lyric lookup, and format conversion.

## Features

- Decrypt QQ Music QRC hex content and PC local `.qm.qrc` cache files.
- Parse decrypted QRC XML `LyricContent` fields.
- Convert QRC line and word timing to standard LRC timestamps.
- Output plain lyric text when a PC local cache file contains lyrics without timestamps.
- Search QQ Music or NetEase Cloud Music online lyric candidates and use the best timestamped result when local cache only contains plain text.
- Optionally output decrypted XML for inspection.
- Use a local web page to convert QRC or selected online candidates to LRC, with optional audio preview.

## Usage

```bash
npm test
npm run check
npm run web
```

Open the printed local URL to use the web interface. Audio upload is optional and only used for local preview playback. Encrypted `.qrc` and `.qm.qrc` files are read as bytes and sent to the local Node server for conversion. The web page displays the converted LRC output only. PC local cache files may contain plain lyrics without timestamps, so the web page displays them as static lyrics.

Fill in the song title and artist fields to search online lyric candidates. The web page lists candidates with provider, song ID, album, preview text, timestamp coverage, and source label. `歌曲搜索` candidates come from song catalog search. `歌词搜索` candidates come from QQ Music lyric resources and may include demo, live, or adapted versions. You can convert a selected online candidate without uploading audio or QRC.

```bash
# Convert encrypted QRC hex file or PC local .qm.qrc cache file to LRC
node src/cli.js --input encrypted.qrc --output lyrics.lrc

# Print LRC to stdout
node src/cli.js --text E9056DD20F5E...

# Convert already decrypted XML or QRC text
node src/cli.js --xml --input decrypted.xml --output lyrics.lrc

# Save decrypted XML only
node src/cli.js --input encrypted.qrc --output-xml decrypted.xml

# Search QQ Music online and output the best timestamped LRC candidate
node src/cli.js --search-title "12.31" --search-artist "郑润泽" --provider qqmusic --output lyrics.lrc

# Search NetEase Cloud Music online and output the best timestamped LRC candidate
node src/cli.js --search-title "晴天" --search-artist "周杰伦" --provider netease --output lyrics.lrc

# List online lyric candidates and timestamp coverage
node src/cli.js --search-title "晴天" --search-artist "周杰伦" --provider netease --list-matches

# Use a specific online song ID from the candidate list
node src/cli.js --search-title "晴天" --search-artist "周杰伦" --provider netease --song-id 186016 --output lyrics.lrc
```

## API

```js
import { decryptQrc, parseQrcXml, toLrc } from './src/qrc2lrc.js'

const xml = decryptQrc(encryptedHex)
const lines = parseQrcXml(xml)
const lrc = toLrc(lines)
```

## How It Works

1. Hex QRC input is decoded to bytes, while PC local cache files are first unmasked with the QMC dynamic mask and parsed after the `[offset:n]` header.
2. Bytes are decrypted with QQ Music's custom 3DES-compatible bit-level routine.
3. The decrypted payload is inflated with zlib.
4. `LyricContent` is parsed from QRC XML when timestamps exist.
5. QRC line and word timing are flattened to standard LRC timestamps, or plain text is emitted when timestamps are absent.
6. Online lookup searches QQ Music or NetEase Cloud Music candidates by title and artist, then selects the candidate with the most timestamped lines.

## Current Scope

- Local encrypted QRC hex and PC local `.qm.qrc` cache to LRC conversion.
- Local decrypted XML/QRC text to LRC conversion.
- Decrypted XML export for debugging.
- Synced web playback requires timestamped QRC content; plain local cache lyrics are displayed statically.
- Online timestamp completion depends on QQ Music or NetEase Cloud Music returning a matching lyric candidate.

## Reference

- `tomakino/qrckit`: https://github.com/tomakino/qrckit
- `WXRIW/QQMusicDecoder`: https://github.com/WXRIW/QQMusicDecoder
