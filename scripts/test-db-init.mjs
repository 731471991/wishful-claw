import { spawn } from 'child_process'
import * as net from 'net'
import * as path from 'path'
import { encode, decode } from '@msgpack/msgpack'
import * as fs from 'fs'

const workerPath = path.join(
  process.cwd(),
  'src', 'runtime', 'WishfulClaw.Worker', 'bin', 'Debug', 'net10.0',
  'WishfulClaw.Worker.exe'
)

if (!fs.existsSync(workerPath)) {
  console.error('Worker not found at', workerPath)
  process.exit(1)
}

const endpoint = `\\\\.\\pipe\\wc-test-${process.pid}-${Date.now()}`
console.log('Starting worker at', endpoint)

const child = spawn(workerPath, ['--ipc', endpoint], {
  cwd: path.dirname(workerPath),
  stdio: ['ignore', 'ignore', 'pipe']
})

child.on('exit', (code) => {
  console.log('Worker exited with code', code)
})

child.stderr?.on('data', (chunk) => {
  const text = chunk.toString('utf8').trim()
  if (text) console.error('[Worker]', text)
})

const FRAME_HEADER_BYTES = 4

async function connectAndTest() {
  // Retry connect
  const socket = await new Promise((resolve, reject) => {
    const deadline = Date.now() + 10000
    const tryConnect = () => {
      const s = net.createConnection(endpoint)
      const timer = setTimeout(() => { s.destroy(); reject(new Error('connect timeout')) }, 2000)
      s.once('connect', () => { clearTimeout(timer); resolve(s) })
      s.once('error', (err) => {
        clearTimeout(timer)
        if (Date.now() > deadline) reject(err)
        else setTimeout(tryConnect, 200)
      })
    }
    tryConnect()
  })

  console.log('Connected to worker')

  let chunks = []
  let buffered = 0
  let pendingLen = -1
  let resolveResponse = null

  socket.on('data', (chunk) => {
    chunks.push(chunk)
    buffered += chunk.length

    while (true) {
      if (pendingLen < 0) {
        if (buffered < FRAME_HEADER_BYTES) return
        const header = consume(FRAME_HEADER_BYTES)
        pendingLen = header.readUInt32BE(0)
      }
      if (buffered < pendingLen) return
      const payload = consume(pendingLen)
      pendingLen = -1
      const decoded = decode(payload)
      if (resolveResponse) {
        resolveResponse(decoded)
        resolveResponse = null
      }
    }

    function consume(count) {
      const first = chunks[0]
      if (first.length >= count) {
        const out = first.subarray(0, count)
        if (first.length === count) chunks.shift()
        else chunks[0] = first.subarray(count)
        buffered -= count
        return out
      }
      const out = Buffer.allocUnsafe(count)
      let offset = 0
      while (offset < count) {
        const c = chunks[0]
        const take = Math.min(c.length, count - offset)
        c.copy(out, offset, 0, take)
        if (take === c.length) chunks.shift()
        else chunks[0] = c.subarray(take)
        offset += take
      }
      buffered -= count
      return out
    }
  })

  function sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      const id = Date.now()
      const payload = encode({ id, method, params })
      const header = Buffer.allocUnsafe(4)
      header.writeUInt32BE(payload.length, 0)
      resolveResponse = resolve
      socket.write(Buffer.concat([header, Buffer.from(payload)]))
      setTimeout(() => reject(new Error(`timeout: ${method}`)), 15000)
    })
  }

  // Test 1: ping
  const pingResp = await sendRequest('worker/ping', {})
  console.log('ping response:', JSON.stringify(pingResp))

  // Test 2: db/initialize
  const initResp = await sendRequest('db/initialize', {})
  console.log('db/initialize response:', JSON.stringify(initResp))

  // Test 3: db/projects-ensure-default
  const ensureResp = await sendRequest('db/projects-ensure-default', {})
  console.log('db/projects-ensure-default response:', JSON.stringify(ensureResp))

  // Test 4: db/projects-list
  const listResp = await sendRequest('db/projects-list', {})
  console.log('db/projects-list response:', JSON.stringify(listResp))

  // Test 5: db/sessions-create
  const now = Date.now()
  const createResp = await sendRequest('db/sessions-create', {
    id: 'test-session-1',
    title: 'Test Session',
    mode: 'chat',
    createdAt: now,
    updatedAt: now
  })
  console.log('db/sessions-create response:', JSON.stringify(createResp))

  // Test 6: db/messages-upsert
  const upsertResp = await sendRequest('db/messages-upsert', {
    id: 'test-msg-1',
    sessionId: 'test-session-1',
    role: 'user',
    content: 'Hello World',
    createdAt: now,
    sortOrder: 0
  })
  console.log('db/messages-upsert response:', JSON.stringify(upsertResp))

  // Test 7: db/messages-list
  const msgListResp = await sendRequest('db/messages-list', {
    sessionId: 'test-session-1'
  })
  console.log('db/messages-list response:', JSON.stringify(msgListResp))

  // Test 8: db/sessions-list
  const sessListResp = await sendRequest('db/sessions-list', {})
  console.log('db/sessions-list response:', JSON.stringify(sessListResp))

  console.log('\n=== All tests passed! ===')
  socket.destroy()
  child.kill()
  process.exit(0)
}

connectAndTest().catch(err => {
  console.error('Test failed:', err)
  child.kill()
  process.exit(1)
})
