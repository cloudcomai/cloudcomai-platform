import * as ExpoContacts from 'expo-contacts';

function pickEmail(contact) {
  return contact?.emails?.find(item => item?.email)?.email || null;
}

function pickPhone(contact) {
  return contact?.phoneNumbers?.find(item => item?.number)?.number || null;
}

export async function syncPhoneContacts(api) {
  try {
    const permission = await ExpoContacts.requestPermissionsAsync();
    if (permission.status !== 'granted') return { granted: false, count: 0 };
    const result = await ExpoContacts.getContactsAsync({
      fields: [ExpoContacts.Fields.Emails, ExpoContacts.Fields.PhoneNumbers, ExpoContacts.Fields.Image],
      pageSize: 5000,
    });
    const contacts = (result.data || []).map(contact => ({
      name: contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(' '),
      email: pickEmail(contact),
      phone: pickPhone(contact),
    })).filter(contact => contact.email || contact.phone);
    await api.syncPhoneContacts(contacts);
    return { granted: true, count: contacts.length };
  } catch {
    return { granted: false, count: 0 };
  }
}

export async function loadMobileContacts(api, page = 1, pageSize = 500) {
  await syncPhoneContacts(api);
  try {
    const { data } = await api.getGoogleStatus();
    if (data?.connected) await api.syncGoogleContacts();
  } catch {
    // Existing saved/phone/Google snapshots remain usable when Google is unavailable.
  }
  const { data } = await api.listContacts(page, pageSize);
  return data?.contacts || [];
}
