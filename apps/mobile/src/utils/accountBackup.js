export function assertBackupConnection(settings, network) {
  if (!network?.isConnected || network.isInternetReachable === false) {
    throw new Error('Connect to the internet before starting a backup.');
  }
  if (settings?.wifi_only !== false && network.type !== 'WIFI') {
    throw new Error('Connect to Wi-Fi or turn off Backup over Wi-Fi only.');
  }
}
