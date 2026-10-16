let worker = null
let nextId = 1
const pending = new Map()
let campaignBusy = false

export function isCampaignRunning() {
  return campaignBusy
}

export function warmupBattleWorker() {
  const host = ensureWorker()
  try {
    host?.postMessage({ type: 'ping' })
  } catch {
    // le worker se chargera au premier combat
  }
}

function ensureWorker() {
  if (worker) return worker
  if (typeof Worker === 'undefined') return null
  try {
    worker = new Worker(new URL('./battle.worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (event) => {
      const { id, type, result, message, progress } = event.data || {}
      const job = pending.get(id)
      if (!job) return
      if (type === 'progress') {
        job.onProgress?.(progress)
        return
      }
      pending.delete(id)
      if (type === 'error') job.reject(new Error(message || 'Simulation impossible'))
      else job.resolve(result)
    }
    worker.onerror = (error) => {
      for (const job of pending.values()) job.reject(error)
      pending.clear()
      worker = null
    }
    return worker
  } catch {
    worker = null
    return null
  }
}

export async function runBattleCampaign(payload, onProgress) {
  if (campaignBusy) {
    throw new Error('Une simulation est déjà en cours.')
  }
  campaignBusy = true
  try {
    const host = ensureWorker()
    if (host) {
      const id = nextId
      nextId += 1
      return await new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, onProgress })
        host.postMessage({ type: 'run', id, payload })
      })
    }
    const { runSimulations } = await import('./simulate.js')
    return await runSimulations(payload, onProgress)
  } finally {
    campaignBusy = false
  }
}
