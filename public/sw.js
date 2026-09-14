/* eslint-env serviceworker */

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = { title: 'Game Center', body: '' }

  try {
    data = event.data ? event.data.json() : data
  } catch {
    data = { title: 'Game Center', body: event.data?.text?.() || '' }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Game Center', {
      body: data.body || '',
      icon: new URL('icon-192.png', self.registration.scope).href,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(self.registration.scope))
})
