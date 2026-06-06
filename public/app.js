const audioInput = document.querySelector('#audioInput')
const qrcInput = document.querySelector('#qrcInput')
const includeTranslation = document.querySelector('#includeTranslation')
const searchTitle = document.querySelector('#searchTitle')
const searchArtist = document.querySelector('#searchArtist')
const lyricProvider = document.querySelector('#lyricProvider')
const searchButton = document.querySelector('#searchButton')
const candidateList = document.querySelector('#candidateList')
const convertButton = document.querySelector('#convertButton')
const downloadButton = document.querySelector('#downloadButton')
const lrcOutput = document.querySelector('#lrcOutput')
const lyrics = document.querySelector('#lyrics')
const uploadPanel = document.querySelector('.upload-panel')
const audio = document.querySelector('#audio')
const playerPanel = document.querySelector('.player-panel')
const miniPlayer = document.querySelector('#miniPlayer')
const miniToggleButton = document.querySelector('#miniToggleButton')
const miniPlayButton = document.querySelector('#miniPlayButton')
const miniTrackName = document.querySelector('#miniTrackName')
const miniTrackTime = document.querySelector('#miniTrackTime')
const miniSeek = document.querySelector('#miniSeek')
const trackName = document.querySelector('#trackName')
const trackTime = document.querySelector('#trackTime')
const statusLabel = document.querySelector('#statusLabel')
const lineCount = document.querySelector('#lineCount')
const disc = document.querySelector('#disc')
const heroArt = document.querySelector('#heroArt')
const followLyrics = document.querySelector('#followLyrics')
const lyricsMode = document.querySelector('#lyricsMode')
const makerTextInput = document.querySelector('#makerTextInput')
const loadMakerTextButton = document.querySelector('#loadMakerTextButton')
const prepareMakerButton = document.querySelector('#prepareMakerButton')
const stampMakerButton = document.querySelector('#stampMakerButton')
const removeStampButton = document.querySelector('#removeStampButton')
const makerLineList = document.querySelector('#makerLineList')

let lyricLines = []
let plainLyricLines = []
let activeIndex = -1
let audioUrl = ''
let qrcPayload = ''
let qrcMode = 'encrypted'
let qrcEncoding = 'base64'
let candidates = []
let selectedCandidate = null
let makerLines = []
let makerIndex = 0
let makerActive = false
let makerRecording = false

audioInput.addEventListener('change', () => {
  const [file] = audioInput.files
  if (!file) return

  if (audioUrl) {
    URL.revokeObjectURL(audioUrl)
  }

  audioUrl = URL.createObjectURL(file)
  audio.src = audioUrl
  trackName.textContent = file.name
  miniTrackName.textContent = file.name
  miniPlayer.classList.add('visible')
  updateMiniPlayer()
  setStatus('音频已加载')
})

qrcInput.addEventListener('change', async () => {
  const [file] = qrcInput.files
  if (!file) return

  const lowerName = file.name.toLowerCase()
  const isTextLyrics = lowerName.endsWith('.xml') || lowerName.endsWith('.txt')
  qrcMode = isTextLyrics ? 'xml' : 'encrypted'
  qrcEncoding = isTextLyrics ? 'text' : 'base64'
  qrcPayload = isTextLyrics ? await file.text() : await arrayBufferToBase64(await file.arrayBuffer())
  inferSearchFields(file.name)
  setStatus('QRC 已加载')
})

searchButton.addEventListener('click', async () => {
  if (!searchTitle.value.trim()) {
    setStatus('请输入歌名后搜索候选', true)
    return
  }

  setStatus('正在搜索歌词候选...')
  searchButton.disabled = true
  try {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchTitle: searchTitle.value.trim(),
        searchArtist: searchArtist.value.trim(),
        provider: lyricProvider.value
      })
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || '搜索失败')
    }
    candidates = data.results || []
    selectedCandidate = null
    renderCandidates()
    syncLyricsPanelHeight()
    setStatus(`找到 ${candidates.length} 个候选`)
  } catch (error) {
    setStatus(error.message, true)
  } finally {
    searchButton.disabled = false
  }
})

convertButton.addEventListener('click', () => {
  convertToLrc()
})

async function convertToLrc() {
  if (!qrcPayload && !selectedCandidate) {
    setStatus('请先上传 QRC 文件，或搜索并选择一个歌词候选', true)
    return
  }

  setStatus('正在转换...')
  convertButton.disabled = true

  try {
    const response = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        qrc: qrcPayload,
        mode: qrcMode,
        qrcEncoding,
        includeTranslation: includeTranslation.checked,
        searchTitle: searchTitle.value.trim(),
        searchArtist: searchArtist.value.trim(),
        provider: lyricProvider.value,
        selectedSongId: selectedCandidate?.song.id,
        selectedProvider: selectedCandidate?.song.provider,
        selectedTitle: selectedCandidate?.song.title,
        selectedArtist: selectedCandidate?.song.artist,
        selectedAlbum: selectedCandidate?.song.album
      })
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Convert failed')
    }

    const coverUrl = selectedCandidate?.song.coverUrl || data.match?.coverUrl || ''
    updateDiscCover(coverUrl)

    lrcOutput.value = data.lrc
    lyricLines = parseLrc(data.lrc)
    plainLyricLines = parsePlainLyrics(data.lrc)
    renderLyrics()
    downloadButton.disabled = !data.lrc.trim()
    lineCount.textContent = data.timedLineCount > 0 ? `${data.lineCount} 行` : `${data.lineCount} 行（无时间轴）`
    setStatus(statusMessage(data))
  } catch (error) {
    setStatus(error.message, true)
  } finally {
    convertButton.disabled = false
  }
}

downloadButton.addEventListener('click', () => {
  const blob = new Blob([lrcOutput.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${downloadBaseName()}.lrc`
  link.click()
  URL.revokeObjectURL(url)
})

loadMakerTextButton.addEventListener('click', () => {
  const text = plainLyricLines.length > 0 ? plainLyricLines.join('\n') : parsePlainLyrics(lrcOutput.value).join('\n')
  makerTextInput.value = text
  setStatus(text ? '已载入当前歌词，可开始标注时间戳' : '当前没有可载入的歌词', !text)
})

prepareMakerButton.addEventListener('click', () => {
  toggleMakerRecording()
})

stampMakerButton.addEventListener('click', () => {
  stampCurrentMakerLine()
})

removeStampButton.addEventListener('click', () => {
  removeCurrentMakerStamp()
})

document.addEventListener('keydown', handleMakerKeydown)
window.addEventListener('resize', syncLyricsPanelHeight)
new ResizeObserver(syncLyricsPanelHeight).observe(uploadPanel)
new ResizeObserver(syncLyricsPanelHeight).observe(candidateList)

miniToggleButton.addEventListener('click', () => {
  audio.muted = !audio.muted
  updateMiniPlayer()
})

miniPlayButton.addEventListener('click', () => {
  toggleMiniPlayback()
})

miniSeek.addEventListener('input', () => {
  if (!Number.isFinite(audio.duration)) return
  audio.currentTime = Number(miniSeek.value) / 1000 * audio.duration
  updateMiniPlayer()
})

audio.addEventListener('timeupdate', syncLyrics)
audio.addEventListener('timeupdate', updateMakerClock)
audio.addEventListener('loadedmetadata', updateTrackTime)
audio.addEventListener('loadedmetadata', updateMiniPlayer)
audio.addEventListener('timeupdate', updateTrackTime)
audio.addEventListener('timeupdate', updateMiniPlayer)
audio.addEventListener('volumechange', updateMiniPlayer)
audio.addEventListener('play', () => disc.classList.add('playing'))
audio.addEventListener('play', updateMiniPlayer)
audio.addEventListener('pause', () => {
  disc.classList.remove('playing')
  if (makerRecording) {
    makerRecording = false
    updateMakerControls()
  }
  updateMiniPlayer()
})
audio.addEventListener('ended', () => {
  disc.classList.remove('playing')
  makerRecording = false
  updateMakerControls()
  updateMiniPlayer()
})

updateMakerControls()
syncLyricsPanelHeight()
window.addEventListener('load', syncLyricsPanelHeight)
requestAnimationFrame(syncLyricsPanelHeight)
setTimeout(syncLyricsPanelHeight, 100)

function parseLrc(lrc) {
  return String(lrc)
    .split(/\r?\n/)
    .flatMap((row) => {
      const matches = [...row.matchAll(/\[(\d{2}):(\d{2})\.(\d{2})]/g)]
      const text = row.replace(/\[\d{2}:\d{2}\.\d{2}]/g, '').trim()

      return matches.map((match) => ({
        time: Number(match[1]) * 60 + Number(match[2]) + Number(match[3]) / 100,
        text: text || '...'
      }))
    })
    .sort((a, b) => a.time - b.time)
}

function parsePlainLyrics(lrc) {
  return String(lrc)
    .split(/\r?\n/)
    .map((row) => row.replace(/\[\d{2}:\d{2}\.\d{2}]/g, '').trim())
    .filter(Boolean)
}

function renderLyrics() {
  activeIndex = -1
  lyrics.innerHTML = ''

  const linesToRender = lyricLines.length > 0 ? lyricLines.map((line) => line.text) : plainLyricLines
  if (linesToRender.length > 0) {
    lyricsMode.textContent = lyricLines.length > 0 ? '同步歌词' : '静态歌词'
    lyrics.classList.toggle('lyrics-synced', lyricLines.length > 0)
    for (const text of linesToRender) {
      const element = document.createElement('p')
      element.textContent = text
      lyrics.append(element)
    }
    return
  }

  if (lyricLines.length === 0) {
    lyricsMode.textContent = '歌词预览'
    lyrics.classList.remove('lyrics-synced')
    lyrics.innerHTML = '<p class="empty-state">没有找到带时间轴的歌词行。</p>'
    return
  }
}

function syncLyrics() {
  if (lyricLines.length === 0) return

  const currentTime = audio.currentTime
  const nextIndex = lyricLines.findIndex((line, index) => {
    const nextLine = lyricLines[index + 1]
    return currentTime >= line.time && (!nextLine || currentTime < nextLine.time)
  })

  if (nextIndex === activeIndex || nextIndex < 0) return

  const elements = lyrics.querySelectorAll('p')
  elements[activeIndex]?.classList.remove('active')
  elements[nextIndex]?.classList.add('active')
  if (followLyrics.checked) {
    centerLyricInPanel(elements[nextIndex])
  }
  activeIndex = nextIndex
}

function centerLyricInPanel(element) {
  if (!element) return

  const targetTop = element.offsetTop - lyrics.clientHeight / 2 + element.clientHeight / 2
  lyrics.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
}

function updateTrackTime() {
  trackTime.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '00:00'

  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

function formatLrcTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0)
  const minutes = Math.floor(safeSeconds / 60)
  const rest = Math.floor(safeSeconds % 60)
  const centiseconds = Math.floor((safeSeconds - Math.floor(safeSeconds)) * 100)
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}

function setStatus(message, isError = false) {
  statusLabel.textContent = message
  statusLabel.style.color = isError ? 'var(--danger)' : ''
}

function fileBaseName(name) {
  return name.replace(/\.[^.]+$/, '')
}

function downloadBaseName() {
  return fileBaseName(qrcInput.files[0]?.name || audioInput.files[0]?.name || selectedCandidate?.song.title || searchTitle.value || 'lyrics')
}

function arrayBufferToBase64(arrayBuffer) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.readAsDataURL(new Blob([arrayBuffer]))
  })
}

function renderCandidates() {
  candidateList.innerHTML = ''
  if (candidates.length === 0) {
    candidateList.innerHTML = '<p class="empty-state">没有找到候选。</p>'
    syncLyricsPanelHeight()
    return
  }

  for (const candidate of candidates) {
    const label = document.createElement('label')
    const isSelected = selectedCandidate === candidate
    label.className = `candidate-option${isSelected ? ' selected' : ''}`
    const radio = document.createElement('input')
    radio.type = 'radio'
    radio.name = 'candidate'
    radio.value = String(candidate.song.id)
    radio.checked = isSelected
    radio.addEventListener('change', () => {
      selectedCandidate = candidate
      updateDiscCover(candidate.song.coverUrl || '')
      renderCandidates()
      syncLyricsPanelHeight()
    })

    const info = document.createElement('div')
    const title = document.createElement('strong')
    title.textContent = `${candidate.song.title} - ${candidate.song.artist || '未知歌手'}`
    const meta = document.createElement('span')
    const status = candidate.error || `${candidate.timedLineCount}/${candidate.lineCount} 行有时间戳`
    meta.textContent = `${providerLabel(candidate.song.provider)} | ${candidate.song.album || '未知专辑'} | id=${candidate.song.id} | ${status}`

    info.append(title, meta)
    label.append(radio, info)

    if (isSelected) {
      const convertCandidateButton = document.createElement('button')
      convertCandidateButton.type = 'button'
      convertCandidateButton.className = 'candidate-convert-button'
      convertCandidateButton.textContent = '转换为 LRC'
      convertCandidateButton.addEventListener('click', (event) => {
        event.preventDefault()
        convertToLrc()
      })
      label.append(convertCandidateButton)
    }

    candidateList.append(label)
  }
  syncLyricsPanelHeight()
}

function syncLyricsPanelHeight() {
  requestAnimationFrame(() => {
    if (window.matchMedia('(max-width: 860px)').matches) {
      lyrics.style.height = ''
      playerPanel.style.height = ''
      return
    }

    playerPanel.style.height = `${Math.round(uploadPanel.getBoundingClientRect().height)}px`
  })
}

function toggleMiniPlayback() {
  if (!audio.src) return
  if (audio.paused) {
    audio.play().catch(() => {})
    return
  }
  audio.pause()
}

function updateMiniPlayer() {
  miniPlayer.classList.toggle('visible', Boolean(audio.src))
  miniPlayer.classList.toggle('playing', !audio.paused)
  miniPlayer.classList.toggle('muted', audio.muted)
  miniTrackTime.textContent = `${formatTime(audio.currentTime || 0)} / ${formatTime(audio.duration || 0)}`
  miniSeek.value = Number.isFinite(audio.duration) && audio.duration > 0 ? String(Math.round(audio.currentTime / audio.duration * 1000)) : '0'
}

function providerLabel(provider) {
  if (provider === 'netease') return '网易云音乐'
  if (provider === 'lrclib') return 'LRCLIB'
  return 'QQ 音乐'
}

function updateDiscCover(coverUrl) {
  if (coverUrl) {
    disc.style.setProperty('--cover-url', `url("${coverUrl}")`)
    playerPanel.style.setProperty('--cover-url', `url("${coverUrl}")`)
    heroArt?.style.setProperty('--cover-url', `url("${coverUrl}")`)
    disc.classList.add('has-cover')
    playerPanel.classList.add('has-cover')
    heroArt?.classList.add('has-cover')
    return
  }

  disc.style.removeProperty('--cover-url')
  playerPanel.style.removeProperty('--cover-url')
  heroArt?.style.removeProperty('--cover-url')
  disc.classList.remove('has-cover')
  playerPanel.classList.remove('has-cover')
  heroArt?.classList.remove('has-cover')
}

function prepareMakerLines(text) {
  makerLines = parseMakerText(text)
  makerIndex = 0
  makerActive = makerLines.length > 0
  makerRecording = false
  updateMakerControls()
  renderMakerLines()
  updateMakerOutput()
  setStatus(makerActive ? '时间戳标注已开启，按空格给当前行标注时间戳' : '请先粘贴纯文本歌词', !makerActive)
}

function parseMakerText(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((row) => row.replace(/\[\d{2}:\d{2}\.\d{2,3}]/g, '').trim())
    .filter(Boolean)
    .map((text) => ({ text, time: null }))
}

function renderMakerLines() {
  const issues = getMakerIssues()
  makerLineList.innerHTML = ''
  if (makerLines.length === 0) {
    makerLineList.innerHTML = '<p class="empty-state">开始后会在这里显示逐行歌词。</p>'
    return
  }

  makerLines.forEach((line, index) => {
    const issue = issues.get(index)
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `maker-line${index === makerIndex ? ' active' : ''}${line.time !== null ? ' stamped' : ''}${issue ? ' invalid' : ''}`
    if (issue) button.title = issue
    button.addEventListener('click', () => selectMakerLine(index))

    const time = document.createElement('span')
    time.textContent = makerDisplayTime(line, index)
    const text = document.createElement('strong')
    text.textContent = `${issue ? '[⚠️警告] ' : ''}${line.text}`

    button.append(time, text)
    makerLineList.append(button)
  })
  keepMakerLineInView()
}

function selectMakerLine(index) {
  makerIndex = Math.min(Math.max(index, 0), makerLines.length - 1)
  renderMakerLines()
  keepMakerLineInView()
}

async function toggleMakerRecording() {
  if (!makerActive || makerLines.length === 0) {
    prepareMakerLines(makerTextInput.value)
    if (!makerActive) return
    audio.currentTime = 0
    makerIndex = 0
  }

  if (makerRecording) {
    audio.pause()
    makerRecording = false
    updateMakerControls()
    setStatus('已暂停标注')
    return
  }

  if (!audio.src) {
    setStatus('请先选择音频文件再开始标注时间戳', true)
    return
  }

  selectFirstUnstampedMakerLine()
  syncAudioToMakerResumePoint()
  makerRecording = true
  updateMakerControls()
  setStatus('正在标注时间戳，按空格写入当前行时间')
  await audio.play()
  renderMakerLines()
  keepMakerLineInView()
}

function stampCurrentMakerLine() {
  if (!makerRecording) return
  if (!makerActive || makerLines.length === 0) {
    prepareMakerLines(makerTextInput.value)
    if (!makerActive) return
  }

  makerLines[makerIndex].time = audio.currentTime || 0
  if (makerIndex < makerLines.length - 1) {
    makerIndex += 1
  }
  renderMakerLines()
  keepMakerLineInView()
  updateMakerOutput()
}

function removeCurrentMakerStamp() {
  if (!makerActive || makerLines.length === 0) return

  const shouldMoveToPrevious = !makerRecording && makerIndex > 0
  makerLines[makerIndex].time = null
  if (shouldMoveToPrevious) {
    makerIndex -= 1
  }
  renderMakerLines()
  keepMakerLineInView()
  updateMakerOutput()
}

function adjustCurrentMakerStamp(delta) {
  if (!makerActive || makerLines.length === 0 || makerLines[makerIndex].time === null) return

  makerLines[makerIndex].time = Math.max(0, makerLines[makerIndex].time + delta)
  renderMakerLines()
  keepMakerLineInView()
  updateMakerOutput()
}

function updateMakerOutput() {
  const lrc = makerLines.map((line) => `${line.time === null ? '' : `[${formatLrcTime(line.time)}]`}${line.text}`).join('\n')
  lrcOutput.value = lrc ? `${lrc}\n` : ''
  lyricLines = parseLrc(lrcOutput.value)
  plainLyricLines = parsePlainLyrics(lrcOutput.value)
  renderLyrics()
  downloadButton.disabled = !lrcOutput.value.trim()
  lineCount.textContent = lyricLines.length > 0 ? `${makerLines.length} 行` : `${makerLines.length} 行（时间戳标注中）`
}

function updateMakerClock() {
  if (!makerActive || makerLines.length === 0) return

  const activeTime = makerLineList.querySelector('.maker-line.active span')
  if (activeTime && makerRecording && makerLines[makerIndex]?.time === null) {
    activeTime.textContent = formatLrcTime(audio.currentTime || 0)
  }
  followMakerPlayback()
}

function followMakerPlayback() {
  if (!makerActive || makerRecording || makerLines.length === 0) return
  const stamped = makerLines
    .map((line, index) => ({ line, index }))
    .filter((item) => item.line.time !== null)
  if (stamped.length === 0) return

  const current = stamped.findLast((item) => audio.currentTime >= item.line.time)
  if (!current || current.index === makerIndex) return

  makerIndex = current.index
  renderMakerLines()
  keepMakerLineInView()
}

function updateMakerControls() {
  prepareMakerButton.textContent = makerRecording ? '暂停标注' : makerActive ? '继续标注' : '开始标注时间戳'
  stampMakerButton.disabled = !makerRecording
}

function selectFirstUnstampedMakerLine() {
  const nextIndex = makerLines.findIndex((line) => line.time === null)
  if (nextIndex >= 0) {
    makerIndex = nextIndex
  }
}

function syncAudioToMakerResumePoint() {
  if (makerLines[makerIndex]?.time !== null) return

  for (let index = makerIndex - 1; index >= 0; index -= 1) {
    if (makerLines[index].time !== null) {
      audio.currentTime = makerLines[index].time
      return
    }
  }
  audio.currentTime = 0
}

function makerDisplayTime(line, index) {
  if (line.time !== null) return formatLrcTime(line.time)
  if (index === makerIndex && makerRecording) return formatLrcTime(audio.currentTime || 0)
  return '--:--:--'
}

function getMakerIssues() {
  const issues = new Map()
  const seen = new Map()
  let previousTimed = null

  makerLines.forEach((line, index) => {
    if (line.time === null) return

    const timeKey = formatLrcTime(line.time)
    if (seen.has(timeKey)) {
      issues.set(index, '有相同时间戳')
      issues.set(seen.get(timeKey), '有相同时间戳')
    } else {
      seen.set(timeKey, index)
    }

    if (previousTimed && line.time < previousTimed.time) {
      issues.set(index, '后边的时间戳不能小于前边')
    }
    previousTimed = { time: line.time, index }
  })

  makerLines.forEach((line, index) => {
    if (line.time !== null) return

    const hasLaterTimedLine = makerLines.slice(index + 1).some((nextLine) => nextLine.time !== null)
    if (hasLaterTimedLine) {
      issues.set(index, '前方歌词缺少时间戳')
    }
  })

  return issues
}

function keepMakerLineInView() {
  requestAnimationFrame(() => {
    const element = makerLineList.querySelector('.maker-line.active')
    if (!element) return

    const padding = 18
    const listRect = makerLineList.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()
    const above = elementRect.top < listRect.top + padding
    const below = elementRect.bottom > listRect.bottom - padding

    if (above) {
      makerLineList.scrollTop -= listRect.top + padding - elementRect.top
      return
    }
    if (below) {
      makerLineList.scrollTop += elementRect.bottom - listRect.bottom + padding
    }
  })
}

function handleMakerKeydown(event) {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return
  if (!makerActive && event.code !== 'Space' && event.key !== 'Enter') return

  if (event.key === 'Enter') {
    event.preventDefault()
    toggleMakerRecording()
    return
  }

  if (event.code === 'Space') {
    event.preventDefault()
    stampCurrentMakerLine()
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    selectMakerLine(makerIndex - 1)
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    selectMakerLine(makerIndex + 1)
    return
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    audio.currentTime = Math.max(0, audio.currentTime - 5)
    return
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    audio.currentTime = Math.min(audio.duration || Number.POSITIVE_INFINITY, audio.currentTime + 5)
    return
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    removeCurrentMakerStamp()
    return
  }
  if (event.key === '+' || event.key === '=') {
    event.preventDefault()
    adjustCurrentMakerStamp(0.1)
    return
  }
  if (event.key === '-') {
    event.preventDefault()
    adjustCurrentMakerStamp(-0.1)
  }
}

function inferSearchFields(fileName) {
  const baseName = fileBaseName(fileName).replace(/\.qm$/i, '')
  const parts = baseName.split(/\s+-\s+/)
  if (parts.length >= 2) {
    searchArtist.value ||= parts[0].trim()
    searchTitle.value ||= parts.slice(1).join(' - ').trim()
    return
  }
  searchTitle.value ||= baseName.trim()
}

function statusMessage(data) {
  if (data.source?.endsWith('-online') && data.match) {
    return `转换完成，已使用${providerLabel(data.match.provider)}在线时间轴：${data.match.title}`
  }
  if (data.source?.endsWith('-selected') && data.match) {
    return data.timedLineCount > 0 ? `转换完成，已使用所选候选：${data.match.id}` : `转换完成，所选候选无时间轴：${data.match.id}`
  }
  return data.timedLineCount > 0 ? '转换完成' : '转换完成，当前歌词无时间轴'
}
