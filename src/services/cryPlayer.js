import { ref } from 'vue'

export const playingCryUrl = ref('')

let audio = null

export function stopCry() {
  if (audio) {
    audio.pause()
    audio = null
  }
  playingCryUrl.value = ''
}

export function toggleCry(url) {
  if (!url) return
  if (playingCryUrl.value === url && audio) {
    stopCry()
    return
  }
  stopCry()
  audio = new Audio(url)
  playingCryUrl.value = url
  audio.addEventListener('ended', stopCry)
  void audio.play().catch(stopCry)
}
