const REFERER = 'https://www.kugou.com/'

export async function searchKugouCover({ title, artist = '' } = {}) {
  if (!String(title || '').trim()) return ''

  const appleCover = await searchAppleCover({ title, artist })
  if (appleCover) return appleCover

  const url = new URL('https://songsearch.kugou.com/song_search_v2')
  url.search = new URLSearchParams({
    keyword: [title, artist].filter(Boolean).join(' '),
    page: '1',
    pagesize: '10',
    platform: 'WebFilter',
    iscorrection: '1',
    format: 'json'
  })

  try {
    const response = await fetch(url, {
      headers: {
        Referer: REFERER,
        'User-Agent': 'Mozilla/5.0'
      }
    })
    if (!response.ok) return ''

    const payload = await response.json()
    const songs = payload.data?.lists || []
    const ranked = songs
      .map((song, index) => ({ song, index, score: coverMatchScore(song, { title, artist }) }))
      .filter((item) => item.song.Image)
      .sort((a, b) => b.score - a.score || a.index - b.index)

    return normalizeKugouImage(ranked[0]?.song.Image || '')
  } catch {
    return searchNeteaseCover({ title, artist })
  }
}

async function searchAppleCover({ title, artist = '' } = {}) {
  const url = new URL('https://itunes.apple.com/search')
  url.search = new URLSearchParams({
    term: [title, artist].filter(Boolean).join(' '),
    entity: 'song',
    limit: '8',
    country: 'CN'
  })

  try {
    const response = await fetch(url)
    if (!response.ok) return ''
    const payload = await response.json()
    const ranked = (payload.results || [])
      .map((song, index) => ({ song, index, score: appleCoverScore(song, { title, artist }) }))
      .filter((item) => item.song.artworkUrl100)
      .sort((a, b) => b.score - a.score || a.index - b.index)
    return normalizeAppleArtwork(ranked[0]?.song.artworkUrl100 || '')
  } catch {
    return ''
  }
}

function appleCoverScore(song, { title, artist }) {
  const wantedTitle = normalizeText(title)
  const wantedArtist = normalizeText(artist)
  const songTitle = normalizeText(song.trackName || '')
  const songArtist = normalizeText(song.artistName || '')

  let score = 0
  if (wantedTitle && songTitle === wantedTitle) score += 1000
  if (wantedTitle && songTitle.startsWith(wantedTitle)) score += 700
  if (wantedTitle && songTitle.includes(wantedTitle)) score += 500
  if (wantedArtist && songArtist.includes(wantedArtist)) score += 220
  if (/live|伴奏|翻唱|cover|remix|钢琴/.test(songTitle)) score -= 180
  return score
}

function normalizeAppleArtwork(url) {
  return String(url || '').replace(/\/100x100bb\.jpg$/, '/600x600bb.jpg')
}

async function searchNeteaseCover({ title, artist = '' } = {}) {
  const url = new URL('https://music.163.com/api/search/get/web')
  url.search = new URLSearchParams({
    s: [title, artist].filter(Boolean).join(' '),
    type: '1',
    limit: '5',
    offset: '0'
  })

  try {
    const response = await fetch(url, { headers: { Referer: 'https://music.163.com/' } })
    if (!response.ok) return ''
    const payload = await response.json()
    const songs = payload.result?.songs || []
    const ranked = songs
      .map((song, index) => ({ song, index, score: neteaseCoverScore(song, { title, artist }) }))
      .filter((item) => neteaseCoverUrl(item.song))
      .sort((a, b) => b.score - a.score || a.index - b.index)
    return neteaseCoverUrl(ranked[0]?.song) || ''
  } catch {
    return ''
  }
}

function neteaseCoverUrl(song) {
  if (song?.album?.picUrl) return song.album.picUrl
  return ''
}

function neteaseCoverScore(song, { title, artist }) {
  const wantedTitle = normalizeText(title)
  const wantedArtist = normalizeText(artist)
  const songTitle = normalizeText(song.name || '')
  const songArtist = normalizeText((song.artists || []).map((item) => item.name).join(' '))

  let score = 0
  if (wantedTitle && songTitle === wantedTitle) score += 1000
  if (wantedTitle && songTitle.includes(wantedTitle)) score += 500
  if (wantedArtist && songArtist.includes(wantedArtist)) score += 180
  return score
}

export async function fillKugouCovers(results) {
  const coverCache = new Map()
  const filled = []

  for (const result of results) {
    const song = result.song || {}
    if (song.coverUrl) {
      filled.push(result)
      continue
    }

    const key = `${song.title || ''}\n${song.artist || ''}`
    if (!coverCache.has(key)) {
      coverCache.set(key, await searchKugouCover({ title: song.title, artist: song.artist }))
    }

    filled.push({
      ...result,
      song: { ...song, coverUrl: coverCache.get(key) || '' }
    })
  }

  return filled
}

function coverMatchScore(song, { title, artist }) {
  const wantedTitle = normalizeText(title)
  const wantedArtist = normalizeText(artist)
  const songTitle = normalizeText(song.SongName || song.FileName || '')
  const songArtist = normalizeText(song.SingerName || '')

  let score = 0
  if (wantedTitle && songTitle === wantedTitle) score += 1000
  if (wantedTitle && songTitle.startsWith(wantedTitle)) score += 700
  if (wantedTitle && songTitle.includes(wantedTitle)) score += 500
  if (wantedArtist && songArtist.includes(wantedArtist)) score += 180
  if (/demo|live|伴奏|翻唱|cover|remix|伤感版|正式版|原唱/.test(songTitle)) score -= 120
  return score
}

function normalizeKugouImage(image) {
  return String(image || '').replace('{size}', '480').replace(/^http:\/\//, 'https://')
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[（(].*?[）)]/g, '')
    .replace(/[\s\-_.·、，,。:：'"“”‘’/\\]/g, '')
    .trim()
}
