/* eslint-env serviceworker */

// Écoute les notifications push entrantes
self.addEventListener('push', (event) => {
    const data = event.data.json()
  
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png'
    })
  })
  
  // Quand on clique sur la notification → ouvre l'app
  self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    clients.openWindow('/')
  })