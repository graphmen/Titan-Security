/**
 * Push notification scaffold — logs intended notifications locally.
 * Wire to Firebase Cloud Messaging when FCM_SERVER_KEY is configured.
 */

const queue = [];

export function queuePushNotification(payload) {
  const entry = {
    id: `push-${Date.now()}`,
    queuedAt: new Date().toISOString(),
    delivered: false,
    provider: process.env.FCM_SERVER_KEY ? 'fcm' : 'local_scaffold',
    ...payload,
  };
  queue.unshift(entry);
  if (queue.length > 100) queue.length = 100;
  if (process.env.NODE_ENV !== 'production') {
    console.info('[Titan Push Scaffold]', entry.title || entry.type, entry.body || '');
  }
  return entry;
}

export function getPushNotificationQueue() {
  return [...queue];
}
