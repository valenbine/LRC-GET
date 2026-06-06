#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs'
import { decryptQrc, parseQrcXml, toLrc } from './qrc2lrc.js'
import { fetchQqMusicLyricsById, findBestTimedQqMusicLyrics, inspectQqMusicLyrics } from './qqmusic-api.js'
import { fetchNeteaseLyricsById, findBestTimedNeteaseLyrics, inspectNeteaseLyrics } from './netease-api.js'
import { fetchLrclibLyricsById, findBestTimedLrclibLyrics, inspectLrclibLyrics } from './lrclib-api.js'

async function main(argv) {
  const args = parseArgs(argv)

  if (args.help) {
    printHelp()
    return
  }

  if (args.searchTitle) {
    const provider = args.provider || 'qqmusic'
    if (args.songId) {
      const selected = await fetchSelectedLyrics({ provider, songId: args.songId, title: args.searchTitle, artist: args.searchArtist })
      writeOrPrint(args.output, selected.lrc)
      return
    }

    if (args.listMatches) {
      const results = await inspectLyrics({ provider, title: args.searchTitle, artist: args.searchArtist })
      writeOrPrint(args.output, formatSearchResults(results))
      return
    }

    const results = await findBestTimedLyrics({ provider, title: args.searchTitle, artist: args.searchArtist })

    const best = results.find((result) => result.timedLineCount > 0) || results[0]
    if (!best || best.error) {
      throw new Error(best?.error || 'No QQ Music lyrics found')
    }
    writeOrPrint(args.output, best.lrc)
    return
  }

  const input = args.input ? readFileSync(args.input) : args.text
  if (!input) {
    throw new Error('Missing input. Use --input <file> or --text <hex>')
  }

  const xml = args.xml ? input.toString('utf8') : decryptQrc(input)
  if (args.outputXml) {
    writeOrPrint(args.outputXml, xml)
    return
  }

  const lines = parseQrcXml(xml)
  const lrc = toLrc(lines, { includeTranslation: !args.noTranslation })
  writeOrPrint(args.output, lrc)
}

function parseArgs(argv) {
  const args = {}

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    switch (arg) {
      case '--help':
      case '-h':
        args.help = true
        break
      case '--input':
      case '-i':
        args.input = argv[++index]
        break
      case '--text':
      case '-t':
        args.text = argv[++index]
        break
      case '--output':
      case '-o':
        args.output = argv[++index]
        break
      case '--output-xml':
        args.outputXml = argv[++index] || '-'
        break
      case '--xml':
        args.xml = true
        break
      case '--no-translation':
        args.noTranslation = true
        break
      case '--search-title':
        args.searchTitle = argv[++index]
        break
      case '--search-artist':
        args.searchArtist = argv[++index]
        break
      case '--list-matches':
        args.listMatches = true
        break
      case '--song-id':
        args.songId = argv[++index]
        break
      case '--provider':
        args.provider = argv[++index]
        break
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return args
}

function writeOrPrint(output, content) {
  if (!output || output === '-') {
    process.stdout.write(content)
    return
  }
  writeFileSync(output, content, 'utf8')
}

async function fetchSelectedLyrics({ provider, songId, title, artist }) {
  if (provider === 'netease') return fetchNeteaseLyricsById({ songId, title, artist })
  if (provider === 'lrclib') return fetchLrclibLyricsById({ songId, title, artist })
  return fetchQqMusicLyricsById({ songId, title, artist })
}

async function inspectLyrics({ provider, title, artist }) {
  if (provider === 'netease') return inspectNeteaseLyrics({ title, artist })
  if (provider === 'lrclib') return inspectLrclibLyrics({ title, artist })
  return inspectQqMusicLyrics({ title, artist })
}

async function findBestTimedLyrics({ provider, title, artist }) {
  if (provider === 'netease') return findBestTimedNeteaseLyrics({ title, artist })
  if (provider === 'lrclib') return findBestTimedLrclibLyrics({ title, artist })
  return findBestTimedQqMusicLyrics({ title, artist })
}

function formatSearchResults(results) {
  return `${results.map((result, index) => {
    const song = result.song
    const status = result.error ? `错误：${result.error}` : `${result.timedLineCount}/${result.lineCount} 行有时间戳`
    const source = song.source === 'song-search' || song.source === 'netease-search' ? '歌曲搜索' : '歌词搜索'
    const provider = song.provider === 'netease' ? '网易云音乐' : song.provider === 'lrclib' ? 'LRCLIB' : 'QQ 音乐'
    return `${index + 1}. ${song.title} - ${song.artist || '未知歌手'} [${song.album || '未知专辑'}] id=${song.id} ${provider} ${source} ${status}`
  }).join('\n')}\n`
}

function printHelp() {
  process.stdout.write(`LRC-GET词探

Usage:
  lrc-get --input encrypted.qrc --output lyrics.lrc
  lrc-get --input local.qm.qrc --output lyrics.lrc
  lrc-get --text <encrypted-hex>
  lrc-get --xml --input decrypted.xml --output lyrics.lrc
  lrc-get --search-title "晴天" --search-artist "周杰伦" --provider lrclib --output lyrics.lrc

Options:
  -i, --input <file>        Read encrypted QRC hex, PC local QRC cache, or decrypted XML from file
  -t, --text <hex>          Read encrypted QRC hex from argument
  -o, --output <file>       Write LRC to file, defaults to stdout
      --output-xml <file>   Write decrypted XML/text and skip LRC conversion
      --xml                 Treat input as already decrypted XML/QRC text
      --no-translation      Skip translated lyric lines
      --search-title <name> Search online lyrics by title
      --search-artist <name>Search online lyrics by artist
      --provider <name>     Online provider: qqmusic, netease, or lrclib, defaults to qqmusic
      --song-id <id>        Use a specific online song ID
      --list-matches        Print online lyric candidates instead of LRC
  -h, --help                Show this help
`)
}

try {
  await main(process.argv.slice(2))
} catch (error) {
  process.stderr.write(`Error: ${error.message}\n`)
  process.exitCode = 1
}
