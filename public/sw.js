self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title: 'QueueZap', body: 'Your queue status has changed.' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'queuezap-update',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(self.location.origin));
});
