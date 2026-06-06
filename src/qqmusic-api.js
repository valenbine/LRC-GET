import { decryptQrc, parseQrcXml, toLrc } from './qrc2lrc.js'

const REFERER = 'https://y.qq.com'

export async function searchQqMusicSongs({ title, artist = '', limit = 10 } = {}) {
  if (!String(title || '').trim()) {
    throw new Error('Song title is required')
  }

  const catalogSongs = await searchQqMusicCatalogSongs({ title, artist, limit })
  const lyricSongs = await searchQqMusicLyricSongs({ title, artist, limit })
  return uniqueSongs([...catalogSongs, ...lyricSongs]).slice(0, limit)
}

async function searchQqMusicCatalogSongs({ title, artist = '', limit = 10 }) {
  const url = new URL('https://c.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg')
  url.search = new URLSearchParams({
    key: [title, artist].filter(Boolean).join(' '),
    format: 'json',
    inCharset: 'utf8',
    outCharset: 'utf-8'
  })

  const response = await fetch(url, { headers: { Referer: REFERER } })
  if (!response.ok) {
    return []
  }

  const payload = await response.json()
  const songs = payload.data?.song?.itemlist || []
  return songs.slice(0, limit).map((song) => ({
    id: Number(song.id),
    mid: song.mid || '',
    title: song.name || title,
    artist: song.singer || artist,
    album: '',
    source: 'song-search'
  }))
}

async function searchQqMusicLyricSongs({ title, artist = '', limit = 10 }) {
  const url = new URL('https://c.y.qq.com/lyric/fcgi-bin/fcg_search_pc_lrc.fcg')
  url.search = new URLSearchParams({
    SONGNAME: title,
    SINGERNAME: artist,
    TYPE: '2',
    RANGE_MIN: '1',
    RANGE_MAX: String(limit)
  })

  const response = await fetch(url, { headers: { Referer: REFERER } })
  if (!response.ok) {
    return []
  }

  return parseSearchResults(await response.text()).slice(0, limit)
}

export async function fetchQqMusicLyrics(song) {
  const response = await fetch(`https://u.y.qq.com/cgi-bin/musicu.fcg?pcachetime=${Date.now()}`, {
    method: 'POST',
    headers: {
      Referer: REFERER,
      Host: 'u.y.qq.com'
    },
    body: JSON.stringify(createLyricRequest(song))
  })

  if (!response.ok) {
    throw new Error(`QQ Music lyric request failed: HTTP ${response.status}`)
  }

  const payload = await response.json()
  const root = payload['music.musichallSong.PlayLyricInfo.GetPlayLyricInfo']
  if (payload.code !== 0 || root?.code !== 0) {
    throw new Error('QQ Music lyric request returned an error')
  }

  const data = root.data || {}
  const encrypted = data.lyric || data.qrc
  if (!encrypted) {
    throw new Error('QQ Music did not return lyrics for this song')
  }

  const text = decryptQrc(encrypted)
  const lines = parseQrcXml(text)
  const lrc = toLrc(lines)
  const timedLineCount = lines.filter((line) => Number.isFinite(line.start)).length

  return { text, lines, lrc, lineCount: lines.length, timedLineCount, raw: data }
}

export async function fetchQqMusicLyricsById({ songId, title = '', artist = '', album = '' } = {}) {
  return fetchQqMusicLyrics({ id: Number(songId), title, artist, album })
}

export async function findBestTimedQqMusicLyrics({ title, artist = '', limit = 10 } = {}) {
  const songs = await searchQqMusicSongs({ title, artist, limit })
  const results = []

  for (const song of songs) {
    try {
      const lyric = await fetchQqMusicLyrics(song)
      results.push({ song, ...lyric })
    } catch (error) {
      results.push({ song, error: error.message, lineCount: 0, timedLineCount: 0 })
    }
  }

  results.sort((a, b) => b.timedLineCount - a.timedLineCount || b.lineCount - a.lineCount)
  return results
}

export async function inspectQqMusicLyrics({ title, artist = '', limit = 10 } = {}) {
  const songs = await searchQqMusicSongs({ title, artist, limit })
  const results = []

  for (const song of songs) {
    try {
      const lyric = await fetchQqMusicLyrics(song)
      results.push({
        song,
        lineCount: lyric.lineCount,
        timedLineCount: lyric.timedLineCount,
        preview: lyric.lines.slice(0, 3).map((line) => line.text)
      })
    } catch (error) {
      results.push({ song, lineCount: 0, timedLineCount: 0, preview: [], error: error.message })
    }
  }

  return results
}

function parseSearchResults(xml) {
  return [...String(xml || '').matchAll(/<songinfo\s+id="(\d+)"[^>]*>([\s\S]*?)<\/songinfo>/g)].map((match) => ({
    id: Number(match[1]),
    title: decodeCdataField(match[2], 'name'),
    artist: decodeCdataField(match[2], 'singername'),
    album: decodeCdataField(match[2], 'albumname'),
    source: 'lyric-search'
  }))
}

function uniqueSongs(songs) {
  const seen = new Set()
  const unique = []
  for (const song of songs) {
    if (!song.id || seen.has(song.id)) continue
    seen.add(song.id)
    unique.push(song)
  }
  return unique
}

function decodeCdataField(source, name) {
  const match = new RegExp(`<${name}>\\s*<!\\[CDATA\\[([\\s\\S]*?)]]>\\s*<\\/${name}>`).exec(source)
  const value = match?.[1] || ''
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function createLyricRequest(song) {
  return {
    comm: {
      _channelid: '0',
      _os_version: '6.2.9200-2',
      authst: '',
      ct: '19',
      cv: '1873',
      patch: '118',
      psrf_access_token_expiresAt: 0,
      psrf_qqaccess_token: '',
      psrf_qqopenid: '',
      psrf_qqunionid: '',
      tmeAppID: 'qqmusic',
      tmeLoginType: 2,
      uin: '0',
      wid: '0'
    },
    'music.musichallSong.PlayLyricInfo.GetPlayLyricInfo': {
      method: 'GetPlayLyricInfo',
      module: 'music.musichallSong.PlayLyricInfo',
      param: {
        albumName: toBase64Utf8(song.album || ''),
        crypt: 1,
        ct: 19,
        cv: 1873,
        interval: 0,
        lrc_t: 0,
        qrc: 1,
        qrc_t: 0,
        roma: 1,
        roma_t: 0,
        singerName: toBase64Utf8(song.artist || ''),
        songID: Number(song.id),
        songName: toBase64Utf8(song.title || ''),
        trans: 1,
        trans_t: 0,
        type: -1
      }
    }
  }
}

function toBase64Utf8(text) {
  return Buffer.from(String(text), 'utf8').toString('base64')
}
