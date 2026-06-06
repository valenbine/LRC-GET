import { inflateRawSync, inflateSync } from 'node:zlib'
import { createSchedule, DECRYPT, tripleDESCrypt, tripleDESKeySetup } from './des-helper.js'

const QQ_QRC_KEY = Buffer.from('!@#)(*$%123ZXC!@!@#)(NHL', 'ascii')

export function decryptQrc(encrypted) {
  const encryptedBytes = normalizeEncryptedInput(encrypted)
  if (encryptedBytes.length === 0) {
    throw new Error('QRC encrypted content is empty')
  }

  if (Buffer.isBuffer(encrypted)) {
    const pcQrcText = decryptPcQmQrc(encryptedBytes)
    if (pcQrcText) {
      return pcQrcText
    }
  }

  const candidates = createEncryptedCandidates(encryptedBytes)
  const errors = []

  for (const candidate of candidates) {
    try {
      const xml = decryptCandidate(candidate)
      if (looksLikeQrcXml(xml)) {
        return xml
      }
      errors.push('decrypted content does not look like QRC XML')
    } catch (error) {
      errors.push(error.message)
    }
  }

  const reason = errors.find((message) => message) || 'unknown error'
  if (Buffer.isBuffer(encrypted)) {
    throw new Error(`QRC decrypt failed: unsupported local binary QRC variant (${reason})`)
  }
  throw new Error(`QRC decrypt failed: ${reason}`)
}

function decryptCandidate(encryptedBytes) {
  const schedule = createSchedule()
  tripleDESKeySetup(QQ_QRC_KEY, schedule, DECRYPT)
  const decrypted = Buffer.alloc(encryptedBytes.length)

  for (let offset = 0; offset < encryptedBytes.length; offset += 8) {
    const inputBlock = Buffer.alloc(8)
    const outputBlock = Buffer.alloc(8)
    encryptedBytes.copy(inputBlock, 0, offset, Math.min(offset + 8, encryptedBytes.length))
    tripleDESCrypt(inputBlock, outputBlock, schedule)
    outputBlock.copy(decrypted, offset, 0, Math.min(8, encryptedBytes.length - offset))
  }

  return inflateQrcPayload(decrypted).toString('utf8')
}

function decryptPcQmQrc(encryptedBytes) {
  const decoded = decodeQmcMask(encryptedBytes)
  const firstLineEnd = decoded.indexOf(0x0a)
  if (firstLineEnd < 0) return null

  const header = decoded.subarray(0, firstLineEnd).toString('utf8').trim()
  if (!/^\[offset:-?\d+]$/.test(header)) return null

  return decryptCandidate(decoded.subarray(firstLineEnd + 1))
}

function decodeQmcMask(bytes) {
  const seedMap = [
    [0x4a, 0xd6, 0xca, 0x90, 0x67, 0xf7, 0x52],
    [0x5e, 0x95, 0x23, 0x9f, 0x13, 0x11, 0x7e],
    [0x47, 0x74, 0x3d, 0x90, 0xaa, 0x3f, 0x51],
    [0xc6, 0x09, 0xd5, 0x9f, 0xfa, 0x66, 0xf9],
    [0xf3, 0xd6, 0xa1, 0x90, 0xa0, 0xf7, 0xf0],
    [0x1d, 0x95, 0xde, 0x9f, 0x84, 0x11, 0xf4],
    [0x0e, 0x74, 0xbb, 0x90, 0xbc, 0x3f, 0x92],
    [0x00, 0x09, 0x5b, 0x9f, 0x62, 0x66, 0xa1]
  ]
  let x = -1
  let y = 8
  let dx = 1
  let index = -1
  const decoded = Buffer.alloc(bytes.length)

  for (let offset = 0; offset < bytes.length; offset += 1) {
    decoded[offset] = bytes[offset] ^ nextMask()
  }

  return decoded

  function nextMask() {
    let mask
    index += 1
    if (x < 0) {
      dx = 1
      y = (8 - y) % 8
      mask = 0xc3
    } else if (x > 6) {
      dx = -1
      y = 7 - y
      mask = 0xd8
    } else {
      mask = seedMap[y][x]
    }

    x += dx
    if (index === 0x8000 || (index > 0x8000 && (index + 1) % 0x8000 === 0)) {
      return nextMask()
    }
    return mask
  }
}

function normalizeEncryptedInput(encrypted) {
  if (Buffer.isBuffer(encrypted)) {
    return encrypted
  }

  const cleanHex = String(encrypted ?? '').replace(/\s+/g, '')
  if (!/^[\da-fA-F]+$/.test(cleanHex) || cleanHex.length % 2 !== 0) {
    throw new Error('QRC encrypted content must be an even-length hex string')
  }

  return Buffer.from(cleanHex, 'hex')
}

function createEncryptedCandidates(encryptedBytes) {
  const candidates = []
  const seen = new Set()
  const maxOffset = Math.min(512, Math.max(0, encryptedBytes.length - 8))

  for (let offset = 0; offset <= maxOffset; offset += 1) {
    const alignedLength = Math.floor((encryptedBytes.length - offset) / 8) * 8
    if (alignedLength < 8) continue

    const candidate = encryptedBytes.subarray(offset, offset + alignedLength)
    const key = `${offset}:${candidate.length}`
    if (!seen.has(key)) {
      seen.add(key)
      candidates.push(candidate)
    }
  }

  return candidates
}

function inflateQrcPayload(decrypted) {
  try {
    return inflateSync(decrypted)
  } catch (zlibError) {
    try {
      return inflateRawSync(decrypted)
    } catch {
      throw zlibError
    }
  }
}

function looksLikeQrcXml(xml) {
  return /LyricContent\s*=|\[\d+\s*,\s*\d+]|\[[a-z]+:/i.test(xml) || /\p{L}/u.test(xml)
}

export function parseQrcXml(xml) {
  const source = String(xml ?? '')
  const lyricContents = [...source.matchAll(/LyricContent\s*=\s*"([^"]*)"/g)].map((match) => unescapeXml(match[1]))
  const qrcTexts = lyricContents.length > 0 ? lyricContents : [source]
  const lines = qrcTexts.flatMap((content) => parseQrcText(content))

  if (lines.length > 0) {
    return lines
  }

  return source
    .split(/\r?\n/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => ({ start: null, end: null, duration: 0, text, words: [] }))
}

export function parseQrcText(content) {
  const linePattern = /\[(\d+)\s*,\s*(\d+)]/g
  const lineMatches = [...String(content ?? '').matchAll(linePattern)]
  const lines = []

  for (let index = 0; index < lineMatches.length; index += 1) {
    const current = lineMatches[index]
    const next = lineMatches[index + 1]
    const start = Number(current[1])
    const duration = Number(current[2])
    const bodyStart = current.index + current[0].length
    const bodyEnd = next?.index ?? content.length
    const body = content.slice(bodyStart, bodyEnd).replace(/^[\r\n]+|[\r\n]+$/g, '')

    if (body.trim()) {
      lines.push(parseLine(start, duration, body))
    }
  }

  return lines.sort((a, b) => a.start - b.start)
}

export function toLrc(lines, options = {}) {
  const includeTranslation = options.includeTranslation ?? true
  const content = []

  for (const line of lines) {
    if (line.text) {
      content.push(Number.isFinite(line.start) ? `${formatTimestamp(line.start)}${line.text}` : line.text)
    }
    if (includeTranslation && line.translation && line.translation !== '//') {
      content.push(Number.isFinite(line.start) ? `${formatTimestamp(line.start)}${line.translation}` : line.translation)
    }
  }

  return `${content.join('\n')}\n`
}

function parseLine(start, duration, body) {
  const words = []
  const wordPattern = /(.*?)\((\d+)\s*,\s*(\d+)\)/g

  for (const match of body.matchAll(wordPattern)) {
    const wordStart = Number(match[2])
    const wordDuration = Number(match[3])
    words.push({
      start: wordStart,
      end: wordStart + wordDuration,
      duration: wordDuration,
      text: match[1]
    })
  }

  const text = words.length > 0 ? words.map((word) => word.text).join('') : body.replace(/\(\d+\s*,\s*\d+\)/g, '')
  return {
    start,
    end: start + duration,
    duration,
    text,
    words
  }
}

function formatTimestamp(milliseconds) {
  const totalCentiseconds = Math.max(0, Math.floor(milliseconds / 10))
  const minutes = Math.floor(totalCentiseconds / 6000)
  const seconds = Math.floor((totalCentiseconds % 6000) / 100)
  const centiseconds = totalCentiseconds % 100
  return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}]`
}

function unescapeXml(source) {
  return source
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replaceAll('&apos;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&#10;', '\n')
    .replaceAll('&#13;', '\r')
}
