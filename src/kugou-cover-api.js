const KUGOU_REFERER = 'https://www.kugou.com/'
const QQ_REFERER = 'https://y.qq.com'
const NETEASE_REFERER = 'https://music.163.com/'
const coverCache = new Map()
const checkedUrlCache = new Map()

export async function searchKugouCover({ title, artist = '' } = {}) {
  if (!String(title || '').trim()) return ''

  const key = normalizeCacheKey(title, artist)
  if (coverCache.has(key)) return coverCache.get(key)

  const sources = [
    () => searchAppleCoverCandidates({ title, artist }),
    () => searchQqCoverCandidates({ title, artist }),
    () => searchKugouCoverCandidates({ title, artist }),
    () => searchNeteaseCoverCandidates({ title, artist })
  ]

  for (const source of sources) {
    const coverUrl = await firstReachableCover(await source())
    if (coverUrl) {
      coverCache.set(key, coverUrl)
      return coverUrl
    }
  }

  coverCache.set(key, '')
  return ''
}

async function firstReachableCover(candidates) {
  for (const url of candidates.filter(Boolean)) {
    if (await isReachableImage(url)) return url
  }
  return ''
}

async function isReachableImage(url) {
  if (checkedUrlCache.has(url)) return checkedUrlCache.get(url)

  try {
    let response = await fetch(url, { method: 'HEAD' })
    if (response.status === 405 || response.status === 403) {
      response = await fetch(url, { method: 'GET' })
    }
    const isImage = response.ok && String(response.headers.get('content-type') || '').startsWith('image/')
    checkedUrlCache.set(url, isImage)
    return isImage
  } catch {
    checkedUrlCache.set(url, false)
    return false
  }
}

async function searchAppleCoverCandidates({ title, artist = '' } = {}) {
  const url = new URL('https://itunes.apple.com/search')
  url.search = new URLSearchParams({
    term: [title, artist].filter(Boolean).join(' '),
    entity: 'song',
    limit: '8',
    country: 'CN'
  })

  try {
    const response = await fetch(url)
    if (!response.ok) return []
    const payload = await response.json()
    return (payload.results || [])
      .map((song, index) => ({ song, index, score: appleCoverScore(song, { title, artist }) }))
      .filter((item) => item.song.artworkUrl100)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((item) => normalizeAppleArtwork(item.song.artworkUrl100))
  } catch {
    return []
  }
}

async function searchQqCoverCandidates({ title, artist = '' } = {}) {
  const songs = await searchQqSongs({ title, artist })
  const candidates = []

  for (const song of songs.slice(0, 5)) {
    const albumMid = await fetchQqAlbumMid(song.id)
    if (albumMid) {
      candidates.push(`https://y.qq.com/music/photo_new/T002R500x500M000${albumMid}.jpg`)
    }
  }

  return candidates
}

async function searchQqSongs({ title, artist = '' } = {}) {
  const url = new URL('https://c.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg')
  url.search = new URLSearchParams({
    key: [title, artist].filter(Boolean).join(' '),
    format: 'json',
    inCharset: 'utf8',
    outCharset: 'utf-8'
  })

  try {
    const response = await fetch(url, { headers: { Referer: QQ_REFERER, 'User-Agent': 'Mozilla/5.0' } })
    if (!response.ok) return []
    const payload = await response.json()
    return (payload.data?.song?.itemlist || [])
      .map((song, index) => ({ song, index, score: qqSongScore(song, { title, artist }) }))
      .filter((item) => item.song.id)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((item) => ({ id: Number(item.song.id), title: item.song.name || '', artist: item.song.singer || '' }))
  } catch {
    return []
  }
}

async function fetchQqAlbumMid(songId) {
  try {
    const response = await fetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      method: 'POST',
      headers: {
        Referer: QQ_REFERER,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify({
        comm: { ct: 24, cv: 0 },
        songinfo: {
          method: 'get_song_detail_yqq',
          module: 'music.pf_song_detail_svr',
          param: { song_id: Number(songId) }
        }
      })
    })
    if (!response.ok) return ''
    const payload = await response.json()
    return payload.songinfo?.data?.track_info?.album?.mid || ''
  } catch {
    return ''
  }
}

async function searchKugouCoverCandidates({ title, artist = '' } = {}) {
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
        Referer: KUGOU_REFERER,
        'User-Agent': 'Mozilla/5.0'
      }
    })
    if (!response.ok) return []

    const payload = await response.json()
    return (payload.data?.lists || [])
      .map((song, index) => ({ song, index, score: coverMatchScore(song, { title, artist }) }))
      .filter((item) => item.song.Image)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((item) => normalizeKugouImage(item.song.Image))
  } catch {
    return []
  }
}

async function searchNeteaseCoverCandidates({ title, artist = '' } = {}) {
  const url = new URL('https://music.163.com/api/search/get/web')
  url.search = new URLSearchParams({
    s: [title, artist].filter(Boolean).join(' '),
    type: '1',
    limit: '5',
    offset: '0'
  })

  try {
    const response = await fetch(url, { headers: { Referer: NETEASE_REFERER } })
    if (!response.ok) return []
    const payload = await response.json()
    return (payload.result?.songs || [])
      .map((song, index) => ({ song, index, score: neteaseCoverScore(song, { title, artist }) }))
      .filter((item) => neteaseCoverUrl(item.song))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((item) => neteaseCoverUrl(item.song))
  } catch {
    return []
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

function qqSongScore(song, { title, artist }) {
  const wantedTitle = normalizeText(title)
  const wantedArtist = normalizeText(artist)
  const songTitle = normalizeText(song.name || '')
  const songArtist = normalizeText(song.singer || '')

  let score = 0
  if (wantedTitle && songTitle === wantedTitle) score += 1000
  if (wantedTitle && songTitle.includes(wantedTitle)) score += 500
  if (wantedArtist && songArtist.includes(wantedArtist)) score += 180
  return score
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
  const filled = []

  for (const result of results) {
    const song = result.song || {}
    if (song.coverUrl && await isReachableImage(song.coverUrl)) {
      filled.push(result)
      continue
    }

    filled.push({
      ...result,
      song: { ...song, coverUrl: await searchKugouCover({ title: song.title, artist: song.artist }) }
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

function normalizeAppleArtwork(url) {
  return String(url || '').replace(/\/100x100bb\.jpg$/, '/600x600bb.jpg')
}

function normalizeKugouImage(image) {
  return String(image || '').replace('{size}', '480').replace(/^http:\/\//, 'https://')
}

function normalizeCacheKey(title, artist) {
  return `${normalizeText(title)}\n${normalizeText(artist)}`
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[（(].*?[）)]/g, '')
    .replace(/[\s\-_.·、，,。:：'"“”‘’/\\]/g, '')
    .trim()
}
