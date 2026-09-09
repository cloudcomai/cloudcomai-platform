export async function loadMobileContacts(api, page = 1, pageSize = 500) {
  let connected = false;

  try {
    const { data } = await api.getGoogleStatus();
    connected = Boolean(data?.connected);
  } catch {
    // Status failures must not hide the last successful contact snapshot.
  }

  if (connected) {
    try {
      await api.syncGoogleContacts();
    } catch {
      // Keep rendering the last successful server snapshot if Google is unavailable.
    }
  }

  const { data } = await api.listContacts(page, pageSize);
  return data?.contacts || [];
}
