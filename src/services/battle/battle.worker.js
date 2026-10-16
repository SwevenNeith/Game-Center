import { Buffer } from 'buffer'

if (!globalThis.Buffer) globalThis.Buffer = Buffer
if (!globalThis.global) globalThis.global = globalThis
if (!globalThis.process) globalThis.process = { env: {} }

import { runSimulations } from './simulate.js'

self.onmessage = async (event) => {
  const { type, payload, id } = event.data || {}
  if (type !== 'run') return
  try {
    const result = await runSimulations(payload, (progress) => {
      self.postMessage({ id, type: 'progress', progress })
    })
    self.postMessage({ id, type: 'done', result })
  } catch (error) {
    self.postMessage({ id, type: 'error', message: error?.message || String(error) })
  }
}
