const API_ROOT = 'https://lrclib.net/api'
const USER_AGENT = 'LRC-GET/1.0'

export async function searchLrclibSongs({ title, artist = '', limit = 10 } = {}) {
  if (!String(title || '').trim()) {
    throw new Error('Song title is required')
  }

  const url = new URL(`${API_ROOT}/search`)
  url.search = new URLSearchParams({
    track_name: title,
    artist_name: artist
  })

  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) {
    throw new Error(`LRCLIB search request failed: HTTP ${response.status}`)
  }

  const payload = await response.json()
  return payload.slice(0, limit).map(toSong).filter((song) => song.id)
}

export async function fetchLrclibLyrics(song) {
  const entry = song.syncedLyrics !== undefined ? song : await fetchLrclibEntry(song.id)
  const lrc = entry.syncedLyrics || entry.plainLyrics || ''
  if (!lrc.trim()) {
    throw new Error('LRCLIB did not return lyrics for this song')
  }

  const normalized = normalizeLrc(lrc)
  const lines = normalized.split(/\r?\n/).filter((line) => line.trim())
  const timedLineCount = lines.filter((line) => /\[\d{2}:\d{2}(?:\.\d{2,3})?]/.test(line)).length
  return { lrc: normalized, lineCount: lines.length, timedLineCount, raw: entry }
}

export async function fetchLrclibLyricsById({ songId } = {}) {
  return fetchLrclibLyrics({ id: Number(songId) })
}

export async function findBestTimedLrclibLyrics({ title, artist = '', limit = 10 } = {}) {
  const songs = await searchLrclibSongs({ title, artist, limit })
  const results = []

  for (const song of songs) {
    try {
      const lyric = await fetchLrclibLyrics(song)
      results.push({ song, ...lyric })
    } catch (error) {
      results.push({ song, error: error.message, lineCount: 0, timedLineCount: 0 })
    }
  }

  results.sort((a, b) => b.timedLineCount - a.timedLineCount || b.lineCount - a.lineCount)
  return results
}

export async function inspectLrclibLyrics({ title, artist = '', limit = 10 } = {}) {
  const songs = await searchLrclibSongs({ title, artist, limit })
  const results = []

  for (const song of songs) {
    try {
      const lyric = await fetchLrclibLyrics(song)
      results.push({
        song: stripLyrics(song),
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

async function fetchLrclibEntry(id) {
  const response = await fetch(`${API_ROOT}/get/${Number(id)}`, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) {
    throw new Error(`LRCLIB lyric request failed: HTTP ${response.status}`)
  }
  return response.json()
}

function stripLyrics(song) {
  const { syncedLyrics, plainLyrics, ...rest } = song
  return rest
}

function toSong(entry) {
  return {
    id: Number(entry.id),
    title: entry.trackName || entry.name || '',
    artist: entry.artistName || '',
    album: entry.albumName || '',
    source: 'lrclib-search',
    provider: 'lrclib',
    duration: entry.duration || 0,
    syncedLyrics: entry.syncedLyrics || '',
    plainLyrics: entry.plainLyrics || ''
  }
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
