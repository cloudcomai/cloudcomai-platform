export function isScreenshotAlert(notification) {
  return notification?.data?.event === 'screenshot';
}

export function filterScreenshotAlerts(notifications) {
  return (notifications || []).filter(isScreenshotAlert);
}
