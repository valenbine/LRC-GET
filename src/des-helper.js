export const ENCRYPT = 1
export const DECRYPT = 0

const sbox1 = [14,4,13,1,2,15,11,8,3,10,6,12,5,9,0,7,0,15,7,4,14,2,13,1,10,6,12,11,9,5,3,8,4,1,14,8,13,6,2,11,15,12,9,7,3,10,5,0,15,12,8,2,4,9,1,7,5,11,3,14,10,0,6,13]
const sbox2 = [15,1,8,14,6,11,3,4,9,7,2,13,12,0,5,10,3,13,4,7,15,2,8,15,12,0,1,10,6,9,11,5,0,14,7,11,10,4,13,1,5,8,12,6,9,3,2,15,13,8,10,1,3,15,4,2,11,6,7,12,0,5,14,9]
const sbox3 = [10,0,9,14,6,3,15,5,1,13,12,7,11,4,2,8,13,7,0,9,3,4,6,10,2,8,5,14,12,11,15,1,13,6,4,9,8,15,3,0,11,1,2,12,5,10,14,7,1,10,13,0,6,9,8,7,4,15,14,3,11,5,2,12]
const sbox4 = [7,13,14,3,0,6,9,10,1,2,8,5,11,12,4,15,13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9,10,6,9,0,12,11,7,13,15,1,3,14,5,2,8,4,3,15,0,6,10,10,13,8,9,4,5,11,12,7,2,14]
const sbox5 = [2,12,4,1,7,10,11,6,8,5,3,15,13,0,14,9,14,11,2,12,4,7,13,1,5,0,15,10,3,9,8,6,4,2,1,11,10,13,7,8,15,9,12,5,6,3,0,14,11,8,12,7,1,14,2,13,6,15,0,9,10,4,5,3]
const sbox6 = [12,1,10,15,9,2,6,8,0,13,3,4,14,7,5,11,10,15,4,2,7,12,9,5,6,1,13,14,0,11,3,8,9,14,15,5,2,8,12,3,7,0,4,10,1,13,11,6,4,3,2,12,9,5,15,10,11,14,1,7,6,0,8,13]
const sbox7 = [4,11,2,14,15,0,8,13,3,12,9,7,5,10,6,1,13,0,11,7,4,9,1,10,14,3,5,12,2,15,8,6,1,4,11,13,12,3,7,14,10,15,6,8,0,5,9,2,6,11,13,8,1,4,10,7,9,5,0,15,14,2,3,12]
const sbox8 = [13,2,8,4,6,15,11,1,10,9,3,14,5,0,12,7,1,15,13,8,10,3,7,4,12,5,6,11,0,14,9,2,7,11,4,1,9,12,14,2,0,6,10,13,15,3,5,8,2,1,14,7,4,10,8,13,15,12,9,0,3,5,6,11]

const keyRndShift = [1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1]
const keyPermC = [56,48,40,32,24,16,8,0,57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35]
const keyPermD = [62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,60,52,44,36,28,20,12,4,27,19,11,3]
const keyCompression = [13,16,10,23,0,4,2,27,14,5,20,9,22,18,11,3,25,7,15,6,26,19,12,1,40,51,30,36,46,54,29,39,50,44,32,47,43,48,38,55,33,52,45,41,49,35,28,31]

function bitNum(bytes, b, c) {
  return (((bytes[Math.floor(b / 32) * 4 + 3 - Math.floor((b % 32) / 8)] >> (7 - (b % 8))) & 1) << c) >>> 0
}

function bitNumIntR(a, b, c) {
  return ((((a >>> (31 - b)) & 1) << c) & 0xff) >>> 0
}

function bitNumIntL(a, b, c) {
  return ((((a << b) >>> 0) & 0x80000000) >>> c) >>> 0
}

function sboxBit(a) {
  return ((a & 0x20) | ((a & 0x1f) >>> 1) | ((a & 1) << 4)) >>> 0
}

export function createSchedule() {
  return Array.from({ length: 3 }, () => Array.from({ length: 16 }, () => new Uint8Array(6)))
}

export function tripleDESKeySetup(key, schedule, mode) {
  if (mode === ENCRYPT) {
    keySchedule(key.subarray(0), schedule[0], ENCRYPT)
    keySchedule(key.subarray(8), schedule[1], DECRYPT)
    keySchedule(key.subarray(16), schedule[2], ENCRYPT)
  } else {
    keySchedule(key.subarray(0), schedule[2], DECRYPT)
    keySchedule(key.subarray(8), schedule[1], ENCRYPT)
    keySchedule(key.subarray(16), schedule[0], DECRYPT)
  }
}

export function tripleDESCrypt(input, output, key) {
  crypt(input, output, key[0])
  crypt(output, output, key[1])
  crypt(output, output, key[2])
}

function keySchedule(key, schedule, mode) {
  let c = 0
  let d = 0
  for (let i = 0, j = 31; i < 28; i += 1, j -= 1) c = (c | bitNum(key, keyPermC[i], j)) >>> 0
  for (let i = 0, j = 31; i < 28; i += 1, j -= 1) d = (d | bitNum(key, keyPermD[i], j)) >>> 0
  for (let i = 0; i < 16; i += 1) {
    c = (((c << keyRndShift[i]) >>> 0) | (c >>> (28 - keyRndShift[i]))) & 0xfffffff0
    d = (((d << keyRndShift[i]) >>> 0) | (d >>> (28 - keyRndShift[i]))) & 0xfffffff0
    const toGen = mode === DECRYPT ? 15 - i : i
    schedule[toGen].fill(0)
    for (let j = 0; j < 24; j += 1) schedule[toGen][Math.floor(j / 8)] |= bitNumIntR(c, keyCompression[j], 7 - (j % 8))
    for (let j = 24; j < 48; j += 1) schedule[toGen][Math.floor(j / 8)] |= bitNumIntR(d, keyCompression[j] - 27, 7 - (j % 8))
  }
}

function ip(state, input) {
  state[0] = (bitNum(input,57,31)|bitNum(input,49,30)|bitNum(input,41,29)|bitNum(input,33,28)|bitNum(input,25,27)|bitNum(input,17,26)|bitNum(input,9,25)|bitNum(input,1,24)|bitNum(input,59,23)|bitNum(input,51,22)|bitNum(input,43,21)|bitNum(input,35,20)|bitNum(input,27,19)|bitNum(input,19,18)|bitNum(input,11,17)|bitNum(input,3,16)|bitNum(input,61,15)|bitNum(input,53,14)|bitNum(input,45,13)|bitNum(input,37,12)|bitNum(input,29,11)|bitNum(input,21,10)|bitNum(input,13,9)|bitNum(input,5,8)|bitNum(input,63,7)|bitNum(input,55,6)|bitNum(input,47,5)|bitNum(input,39,4)|bitNum(input,31,3)|bitNum(input,23,2)|bitNum(input,15,1)|bitNum(input,7,0)) >>> 0
  state[1] = (bitNum(input,56,31)|bitNum(input,48,30)|bitNum(input,40,29)|bitNum(input,32,28)|bitNum(input,24,27)|bitNum(input,16,26)|bitNum(input,8,25)|bitNum(input,0,24)|bitNum(input,58,23)|bitNum(input,50,22)|bitNum(input,42,21)|bitNum(input,34,20)|bitNum(input,26,19)|bitNum(input,18,18)|bitNum(input,10,17)|bitNum(input,2,16)|bitNum(input,60,15)|bitNum(input,52,14)|bitNum(input,44,13)|bitNum(input,36,12)|bitNum(input,28,11)|bitNum(input,20,10)|bitNum(input,12,9)|bitNum(input,4,8)|bitNum(input,62,7)|bitNum(input,54,6)|bitNum(input,46,5)|bitNum(input,38,4)|bitNum(input,30,3)|bitNum(input,22,2)|bitNum(input,14,1)|bitNum(input,6,0)) >>> 0
}

function invIp(state, output) {
  output[3] = bitNumIntR(state[1],7,7)|bitNumIntR(state[0],7,6)|bitNumIntR(state[1],15,5)|bitNumIntR(state[0],15,4)|bitNumIntR(state[1],23,3)|bitNumIntR(state[0],23,2)|bitNumIntR(state[1],31,1)|bitNumIntR(state[0],31,0)
  output[2] = bitNumIntR(state[1],6,7)|bitNumIntR(state[0],6,6)|bitNumIntR(state[1],14,5)|bitNumIntR(state[0],14,4)|bitNumIntR(state[1],22,3)|bitNumIntR(state[0],22,2)|bitNumIntR(state[1],30,1)|bitNumIntR(state[0],30,0)
  output[1] = bitNumIntR(state[1],5,7)|bitNumIntR(state[0],5,6)|bitNumIntR(state[1],13,5)|bitNumIntR(state[0],13,4)|bitNumIntR(state[1],21,3)|bitNumIntR(state[0],21,2)|bitNumIntR(state[1],29,1)|bitNumIntR(state[0],29,0)
  output[0] = bitNumIntR(state[1],4,7)|bitNumIntR(state[0],4,6)|bitNumIntR(state[1],12,5)|bitNumIntR(state[0],12,4)|bitNumIntR(state[1],20,3)|bitNumIntR(state[0],20,2)|bitNumIntR(state[1],28,1)|bitNumIntR(state[0],28,0)
  output[7] = bitNumIntR(state[1],3,7)|bitNumIntR(state[0],3,6)|bitNumIntR(state[1],11,5)|bitNumIntR(state[0],11,4)|bitNumIntR(state[1],19,3)|bitNumIntR(state[0],19,2)|bitNumIntR(state[1],27,1)|bitNumIntR(state[0],27,0)
  output[6] = bitNumIntR(state[1],2,7)|bitNumIntR(state[0],2,6)|bitNumIntR(state[1],10,5)|bitNumIntR(state[0],10,4)|bitNumIntR(state[1],18,3)|bitNumIntR(state[0],18,2)|bitNumIntR(state[1],26,1)|bitNumIntR(state[0],26,0)
  output[5] = bitNumIntR(state[1],1,7)|bitNumIntR(state[0],1,6)|bitNumIntR(state[1],9,5)|bitNumIntR(state[0],9,4)|bitNumIntR(state[1],17,3)|bitNumIntR(state[0],17,2)|bitNumIntR(state[1],25,1)|bitNumIntR(state[0],25,0)
  output[4] = bitNumIntR(state[1],0,7)|bitNumIntR(state[0],0,6)|bitNumIntR(state[1],8,5)|bitNumIntR(state[0],8,4)|bitNumIntR(state[1],16,3)|bitNumIntR(state[0],16,2)|bitNumIntR(state[1],24,1)|bitNumIntR(state[0],24,0)
}

function f(stateIn, key) {
  const t1 = (bitNumIntL(stateIn,31,0)|((stateIn & 0xf0000000)>>>1)|bitNumIntL(stateIn,4,5)|bitNumIntL(stateIn,3,6)|((stateIn & 0x0f000000)>>>3)|bitNumIntL(stateIn,8,11)|bitNumIntL(stateIn,7,12)|((stateIn & 0x00f00000)>>>5)|bitNumIntL(stateIn,12,17)|bitNumIntL(stateIn,11,18)|((stateIn & 0x000f0000)>>>7)|bitNumIntL(stateIn,16,23)) >>> 0
  const t2 = (bitNumIntL(stateIn,15,0)|(((stateIn & 0x0000f000)<<15)>>>0)|bitNumIntL(stateIn,20,5)|bitNumIntL(stateIn,19,6)|(((stateIn & 0x00000f00)<<13)>>>0)|bitNumIntL(stateIn,24,11)|bitNumIntL(stateIn,23,12)|(((stateIn & 0x000000f0)<<11)>>>0)|bitNumIntL(stateIn,28,17)|bitNumIntL(stateIn,27,18)|(((stateIn & 0x0000000f)<<9)>>>0)|bitNumIntL(stateIn,0,23)) >>> 0
  const x0 = ((t1 >>> 24) & 0xff) ^ key[0]
  const x1 = ((t1 >>> 16) & 0xff) ^ key[1]
  const x2 = ((t1 >>> 8) & 0xff) ^ key[2]
  const x3 = ((t2 >>> 24) & 0xff) ^ key[3]
  const x4 = ((t2 >>> 16) & 0xff) ^ key[4]
  const x5 = ((t2 >>> 8) & 0xff) ^ key[5]
  let state = ((sbox1[sboxBit(x0>>>2)]<<28)|(sbox2[sboxBit(((x0&3)<<4)|(x1>>>4))]<<24)|(sbox3[sboxBit(((x1&15)<<2)|(x2>>>6))]<<20)|(sbox4[sboxBit(x2&63)]<<16)|(sbox5[sboxBit(x3>>>2)]<<12)|(sbox6[sboxBit(((x3&3)<<4)|(x4>>>4))]<<8)|(sbox7[sboxBit(((x4&15)<<2)|(x5>>>6))]<<4)|sbox8[sboxBit(x5&63)]) >>> 0
  state = (bitNumIntL(state,15,0)|bitNumIntL(state,6,1)|bitNumIntL(state,19,2)|bitNumIntL(state,20,3)|bitNumIntL(state,28,4)|bitNumIntL(state,11,5)|bitNumIntL(state,27,6)|bitNumIntL(state,16,7)|bitNumIntL(state,0,8)|bitNumIntL(state,14,9)|bitNumIntL(state,22,10)|bitNumIntL(state,25,11)|bitNumIntL(state,4,12)|bitNumIntL(state,17,13)|bitNumIntL(state,30,14)|bitNumIntL(state,9,15)|bitNumIntL(state,1,16)|bitNumIntL(state,7,17)|bitNumIntL(state,23,18)|bitNumIntL(state,13,19)|bitNumIntL(state,31,20)|bitNumIntL(state,26,21)|bitNumIntL(state,2,22)|bitNumIntL(state,8,23)|bitNumIntL(state,18,24)|bitNumIntL(state,12,25)|bitNumIntL(state,29,26)|bitNumIntL(state,5,27)|bitNumIntL(state,21,28)|bitNumIntL(state,10,29)|bitNumIntL(state,3,30)|bitNumIntL(state,24,31)) >>> 0
  return state
}

function crypt(input, output, key) {
  const block = Uint8Array.from(input)
  const state = [0, 0]
  ip(state, block)
  for (let idx = 0; idx < 15; idx += 1) {
    const t = state[1]
    state[1] = (f(state[1], key[idx]) ^ state[0]) >>> 0
    state[0] = t
  }
  state[0] = (f(state[1], key[15]) ^ state[0]) >>> 0
  invIp(state, output)
}
