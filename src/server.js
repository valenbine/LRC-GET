import { createReadStream, existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { decryptQrc, parseQrcXml, toLrc } from './qrc2lrc.js'
import { fetchQqMusicLyricsById, findBestTimedQqMusicLyrics, inspectQqMusicLyrics } from './qqmusic-api.js'
import { fetchNeteaseLyricsById, findBestTimedNeteaseLyrics, inspectNeteaseLyrics } from './netease-api.js'
import { fetchLrclibLyricsById, findBestTimedLrclibLyrics, inspectLrclibLyrics } from './lrclib-api.js'
import { fillKugouCovers, searchKugouCover } from './kugou-cover-api.js'

const rootDir = join(fileURLToPath(new URL('..', import.meta.url)), 'public')
const port = Number(process.env.PORT || 5173)

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml']
])

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'POST' && request.url === '/api/convert') {
      await handleConvert(request, response)
      return
    }

    if (request.method === 'POST' && request.url === '/api/search') {
      await handleSearch(request, response)
      return
    }

    if (request.method === 'GET') {
      serveStatic(request, response)
      return
    }

    sendJson(response, 405, { error: 'Method not allowed' })
  } catch (error) {
    const message = error.message || 'Internal server error'
    const status = message.includes('unsupported local binary QRC variant') ? 422 : 500
    sendJson(response, status, { error: localizeErrorMessage(message) })
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`LRC-GET词探 web app listening on http://localhost:${port}`)
})

async function handleConvert(request, response) {
  const payload = await readRequestBody(request)
  const body = JSON.parse(payload || '{}')
  const qrc = body.qrc || ''
  const mode = body.mode === 'xml' ? 'xml' : 'encrypted'

  if (!String(qrc).trim() && !body.selectedSongId) {
    sendJson(response, 400, { error: 'QRC content is empty' })
    return
  }

  const encryptedInput = body.qrcEncoding === 'base64' ? Buffer.from(qrc, 'base64') : qrc
  const xml = qrc ? (mode === 'xml' ? String(qrc) : decryptQrc(encryptedInput)) : ''
  let lines = xml ? parseQrcXml(xml) : []
  let lrc = toLrc(lines, { includeTranslation: body.includeTranslation !== false })
  let timedLineCount = lines.filter((line) => Number.isFinite(line.start)).length
  let source = 'local'
  let match = null

  const provider = normalizeProvider(body.provider)
  if (body.selectedSongId) {
    const selected = await fetchLyricsByProvider({
      provider: body.selectedProvider || provider,
      songId: body.selectedSongId,
      title: body.searchTitle,
      artist: body.searchArtist,
      album: body.selectedAlbum
    })
    lines = selected.lines || parseLrcLines(selected.lrc)
    lrc = selected.lrc
    timedLineCount = selected.timedLineCount
      source = `${body.selectedProvider || provider}-selected`
      match = {
        id: Number(body.selectedSongId),
        title: body.selectedTitle || body.searchTitle || '',
        artist: body.selectedArtist || body.searchArtist || '',
        album: body.selectedAlbum || '',
        provider: body.selectedProvider || provider
      }
  } else if (timedLineCount === 0 && String(body.searchTitle || '').trim()) {
    const results = await findBestTimedLyrics({ title: body.searchTitle, artist: body.searchArtist, provider })
    const best = results.find((result) => result.timedLineCount > 0)
    if (best) {
      lines = best.lines || parseLrcLines(best.lrc)
      lrc = best.lrc
      timedLineCount = best.timedLineCount
      source = `${best.song.provider || provider}-online`
      match = await withFallbackCover(best.song)
    }
  }

  sendJson(response, 200, { lrc, xml, lineCount: lines.length, timedLineCount, source, match })
}

async function handleSearch(request, response) {
  const payload = await readRequestBody(request)
  const body = JSON.parse(payload || '{}')
  const results = await inspectLyrics({ title: body.searchTitle, artist: body.searchArtist, provider: normalizeProvider(body.provider) })

  sendJson(response, 200, { results })
}

async function inspectLyrics({ title, artist, provider }) {
  if (provider === 'netease') {
    return fillKugouCovers(await inspectNeteaseLyrics({ title, artist }))
  }
  if (provider === 'lrclib') {
    return fillKugouCovers(await inspectLrclibLyrics({ title, artist }))
  }
  if (provider === 'qqmusic') {
    return fillKugouCovers(addProvider(await inspectQqMusicLyrics({ title, artist }), 'qqmusic'))
  }

  const [qqmusic, netease, lrclib] = await Promise.all([
    inspectQqMusicLyrics({ title, artist }).then((results) => addProvider(results, 'qqmusic')),
    inspectNeteaseLyrics({ title, artist }),
    inspectLrclibLyrics({ title, artist })
  ])
  return fillKugouCovers(rankLyricResults([...qqmusic, ...netease, ...lrclib], { title, artist }))
}

async function findBestTimedLyrics({ title, artist, provider }) {
  if (provider === 'netease') {
    return findBestTimedNeteaseLyrics({ title, artist })
  }
  if (provider === 'lrclib') {
    return findBestTimedLrclibLyrics({ title, artist })
  }
  if (provider === 'qqmusic') {
    return addProvider(await findBestTimedQqMusicLyrics({ title, artist }), 'qqmusic')
  }

  const [qqmusic, netease, lrclib] = await Promise.all([
    findBestTimedQqMusicLyrics({ title, artist }).then((results) => addProvider(results, 'qqmusic')),
    findBestTimedNeteaseLyrics({ title, artist }),
    findBestTimedLrclibLyrics({ title, artist })
  ])
  return rankLyricResults([...qqmusic, ...netease, ...lrclib], { title, artist })
}

function rankLyricResults(results, { title, artist }) {
  return [...results]
    .map((result, index) => ({ result, index, score: lyricMatchScore(result.song, { title, artist }) }))
    .sort((a, b) => b.score - a.score || b.result.timedLineCount - a.result.timedLineCount || b.result.lineCount - a.result.lineCount || a.index - b.index)
    .map((item) => item.result)
}

function lyricMatchScore(song, { title, artist }) {
  const wantedTitle = normalizeText(title)
  const wantedArtist = normalizeText(artist)
  const songTitle = normalizeText(song?.title)
  const songArtist = normalizeText(song?.artist)

  let score = 0
  if (wantedTitle && songTitle === wantedTitle) score += 1000
  if (wantedTitle && songTitle.startsWith(wantedTitle)) score += 700
  if (wantedTitle && songTitle.includes(wantedTitle)) score += 500
  if (wantedTitle && wantedTitle.includes(songTitle)) score += 300
  if (wantedArtist && songArtist.includes(wantedArtist)) score += 160
  if (wantedArtist && wantedArtist.includes(songArtist)) score += 80
  if (/demo|live|伴奏|翻唱|cover|remix|伤感版|正式版|原唱/.test(songTitle)) score -= 120
  return score
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[（(].*?[）)]/g, '')
    .replace(/[\s\-_.·、，,。:：'"“”‘’/\\]/g, '')
    .trim()
}

async function fetchLyricsByProvider({ provider, songId, title, artist, album }) {
  if (provider === 'netease') {
    return fetchNeteaseLyricsById({ songId, title, artist, album })
  }
  if (provider === 'lrclib') {
    return fetchLrclibLyricsById({ songId, title, artist, album })
  }
  return fetchQqMusicLyricsById({ songId, title, artist, album })
}

function addProvider(results, provider) {
  return results.map((result) => ({
    ...result,
    song: { ...result.song, provider }
  }))
}

async function withFallbackCover(song) {
  if (song.coverUrl) return song
  return { ...song, coverUrl: await searchKugouCover({ title: song.title, artist: song.artist }) }
}

function normalizeProvider(provider) {
  return ['qqmusic', 'netease', 'lrclib', 'auto'].includes(provider) ? provider : 'auto'
}

function parseLrcLines(lrc) {
  return String(lrc)
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      const match = /\[(\d{2}):(\d{2})\.(\d{2})]/.exec(line)
      return {
        start: match ? (Number(match[1]) * 60 + Number(match[2])) * 1000 + Number(match[3]) * 10 : null,
        text: line.replace(/\[\d{2}:\d{2}\.\d{2}]/g, '').trim()
      }
    })
}

function serveStatic(request, response) {
  const url = new URL(request.url, 'http://localhost')
  const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname
  const safePath = normalize(requestedPath).replace(/^([/\\])+/, '')
  const filePath = join(rootDir, safePath)

  const relativePath = relative(rootDir, filePath)
  if (relativePath.startsWith('..') || relativePath === '' || !existsSync(filePath)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
    return
  }

  response.writeHead(200, { 'Content-Type': mimeTypes.get(extname(filePath)) || 'application/octet-stream' })
  createReadStream(filePath).pipe(response)
}

async function readRequestBody(request) {
  const chunks = []
  let size = 0

  for await (const chunk of request) {
    size += chunk.length
    if (size > 1024 * 1024 * 2) {
      throw new Error('Request body is too large')
    }
    chunks.push(chunk)
  }

  return Buffer.concat(chunks).toString('utf8')
}

function sendJson(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(data))
}

function localizeErrorMessage(message) {
  if (message.includes('unsupported local binary QRC variant')) {
    return '当前 .qrc 文件属于暂未支持的本地二进制变体。请使用 QQ 音乐接口返回的加密 QRC，或提供该文件的来源路径/客户端版本用于适配。'
  }
  if (message.includes('incorrect header check')) {
    return '解密后的数据无法按 QRC 压缩格式解开，可能是文件格式或加密变体不匹配。'
  }
  return message
}
