export async function loadMobileContacts(api, page = 1, pageSize = 500) {
  let connected = false;

  try {
    const { data } = await api.getGoogleStatus();
    connected = Boolean(data?.connected);
  } catch {
    // A status failure should not prevent already-synced contacts from loading.
  }

  if (connected) {
    try {
      await api.syncGoogleContacts();
    } catch {
      // Continue with the last successful contact snapshot when Google sync is unavailable.
    }
  }

  const { data } = await api.listContacts(page, pageSize);
  return data?.contacts || [];
}
