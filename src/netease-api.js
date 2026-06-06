const REFERER = 'https://music.163.com/'

export async function searchNeteaseSongs({ title, artist = '', limit = 10 } = {}) {
  if (!String(title || '').trim()) {
    throw new Error('Song title is required')
  }

  const url = new URL('https://music.163.com/api/search/get/web')
  url.search = new URLSearchParams({
    s: [title, artist].filter(Boolean).join(' '),
    type: '1',
    limit: String(limit),
    offset: '0'
  })

  const response = await fetch(url, { headers: { Referer: REFERER } })
  if (!response.ok) {
    throw new Error(`NetEase search request failed: HTTP ${response.status}`)
  }

  const payload = await response.json()
  return (payload.result?.songs || []).slice(0, limit).map((song) => ({
    id: Number(song.id),
    title: song.name || title,
    artist: (song.artists || []).map((item) => item.name).filter(Boolean).join(' / ') || artist,
    album: song.album?.name || '',
    coverUrl: song.album?.picUrl || '',
    source: 'netease-search',
    provider: 'netease'
  })).filter((song) => song.id)
}

export async function fetchNeteaseLyrics(song) {
  const response = await fetch(`https://music.163.com/api/song/lyric?id=${Number(song.id)}&lv=1&kv=1&tv=-1`, {
    headers: { Referer: REFERER }
  })

  if (!response.ok) {
    throw new Error(`NetEase lyric request failed: HTTP ${response.status}`)
  }

  const payload = await response.json()
  const lrc = payload.lrc?.lyric || ''
  if (!lrc.trim()) {
    throw new Error('NetEase did not return lyrics for this song')
  }

  const lines = lrc.split(/\r?\n/).filter((line) => line.trim())
  const timedLineCount = lines.filter((line) => /\[\d{2}:\d{2}(?:\.\d{2,3})?]/.test(line)).length
  return { lrc: normalizeLrc(lrc), lineCount: lines.length, timedLineCount, raw: payload }
}

export async function fetchNeteaseLyricsById({ songId, title = '', artist = '', album = '' } = {}) {
  return fetchNeteaseLyrics({ id: Number(songId), title, artist, album })
}

export async function findBestTimedNeteaseLyrics({ title, artist = '', limit = 10 } = {}) {
  const songs = await searchNeteaseSongs({ title, artist, limit })
  const results = []

  for (const song of songs) {
    try {
      const lyric = await fetchNeteaseLyrics(song)
      results.push({ song, ...lyric })
    } catch (error) {
      results.push({ song, error: error.message, lineCount: 0, timedLineCount: 0 })
    }
  }

  results.sort((a, b) => b.timedLineCount - a.timedLineCount || b.lineCount - a.lineCount)
  return results
}

export async function inspectNeteaseLyrics({ title, artist = '', limit = 10 } = {}) {
  const songs = await searchNeteaseSongs({ title, artist, limit })
  const results = []

  for (const song of songs) {
    try {
      const lyric = await fetchNeteaseLyrics(song)
      results.push({
        song,
        lineCount: lyric.lineCount,
        timedLineCount: lyric.timedLineCount,
        preview: previewLines(lyric.lrc)
      })
    } catch (error) {
      results.push({ song, lineCount: 0, timedLineCount: 0, preview: [], error: error.message })
    }
  }

  return results
}

function normalizeLrc(lrc) {
  const normalized = String(lrc).replace(/\[(\d{2}:\d{2}\.\d{3})]/g, (_, time) => `[${time.slice(0, -1)}]`)
  return normalized.endsWith('\n') ? normalized : `${normalized}\n`
}

function previewLines(lrc) {
  return String(lrc)
    .split(/\r?\n/)
    .map((line) => line.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?]/g, '').trim())
    .filter(Boolean)
    .slice(0, 3)
}
