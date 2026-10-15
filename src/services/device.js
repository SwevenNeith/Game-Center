import { detectDeviceName } from './notifications.js'

const ID_KEY = 'gamecenter.deviceId'
const NAME_KEY = 'gamecenter.deviceName'

export function getDeviceId() {
  if (typeof localStorage === 'undefined') return 'device'
  let id = localStorage.getItem(ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(ID_KEY, id)
  }
  return id
}

export function getLocalDeviceName() {
  if (typeof localStorage === 'undefined') return detectDeviceName()
  const stored = localStorage.getItem(NAME_KEY)?.trim()
  if (stored) return stored
  const detected = detectDeviceName()
  localStorage.setItem(NAME_KEY, detected)
  return detected
}

export function setLocalDeviceName(name) {
  const trimmed = String(name || '').trim()
  if (!trimmed) return
  localStorage.setItem(NAME_KEY, trimmed)
}
