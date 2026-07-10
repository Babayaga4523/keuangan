// public/sw.js

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    
    const options = {
      body: data.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: { 
        url: data.url || '/recurring',
        billId: data.billId,
        nextDue: data.nextDue
      },
      actions: [
        { action: 'mark_paid', title: 'Tandai Sudah Bayar' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } catch (err) {
    console.error('Failed to display push notification:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'mark_paid') {
    const billId = event.notification.data?.billId;
    const nextDue = event.notification.data?.nextDue;
    if (billId) {
      event.waitUntil(
        fetch('/api/bills/mark-paid', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ billId, nextDue }),
        }).then(response => {
          if (!response.ok) {
            console.error('Failed to mark bill as paid from notification');
          }
        }).catch(err => {
          console.error('Error marking bill as paid from notification:', err);
        })
      );
    }
  } else {
    const targetUrl = event.notification.data?.url || '/recurring';
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        // If a window is already open, focus it
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url.includes(targetUrl) && 'focus' in client) {
            return client.focus();
          }
        }
        // If not open, open a new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
    );
  }
});
